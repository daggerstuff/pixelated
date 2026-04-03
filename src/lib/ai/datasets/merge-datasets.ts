import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { ALLOWED_DIRECTORIES, safeJoin } from "../../../utils/path-security";
import { createBuildSafeLogger } from "../../logging/build-safe-logger";
import { securePathJoin } from "../../utils/server";

const logger = createBuildSafeLogger("default");

export interface DatasetMergeStats {
  totalDatasets: number;
  totalSamples: number;
  mergedSamples: number;
  duplicatesRemoved: number;
  categoriesCount: number;
  qualityScoreAverage: number;
  processingTimeMs: number;
}

export interface MergeDatasetOptions {
  outputFormat: "jsonl" | "json" | "csv";
  removeDuplicates: boolean;
  qualityThreshold: number;
  maxSamples?: number;
  categories?: string[];
}

interface ConversationRecord {
  conversation_id: string;
  source: string;
  messages: Array<{ role: string; content: string }>;
  metadata?: {
    quality_score?: number;
    topic_tags?: string[];
    [key: string]: unknown;
  };
}

async function* findNormalizedFiles(baseDir: string): AsyncGenerator<string> {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(baseDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isFile() && entry.name.endsWith("_normalized.jsonl")) {
      yield safeJoin(baseDir, entry.name);
    }
  }
}

export async function mergeAllDatasets(
  options: MergeDatasetOptions = {
    outputFormat: "jsonl",
    removeDuplicates: true,
    qualityThreshold: 0.7,
  },
): Promise<DatasetMergeStats> {
  const startTime = Date.now();

  logger.info("Starting dataset merge process", { options });

  const normalizedDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "ai", "data", "normalized");
  const outputDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "merged");
  mkdirSync(outputDir, { recursive: true });

  const outputPath = getMergedDatasetPath(options.outputFormat);
  const writeStream = createWriteStream(outputPath, "utf-8");

  const seenIds = new Set<string>();
  const categories = new Set<string>();
  let totalSamples = 0;
  let mergedSamples = 0;
  let duplicatesRemoved = 0;
  let datasetCount = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  for await (const filePath of findNormalizedFiles(normalizedDir)) {
    datasetCount++;
    logger.info(`Merging ${filePath}`);

    const readStream = createReadStream(filePath, "utf-8");
    const rl = createInterface({ input: readStream, crlfDelay: Infinity });

    for await (const line of rl) {
      if (!line.trim()) continue;

      try {
        const record: ConversationRecord = JSON.parse(line);
        totalSamples++;

        if (options.removeDuplicates && seenIds.has(record.conversation_id)) {
          duplicatesRemoved++;
          continue;
        }

        const qualityScore = record.metadata?.quality_score ?? 0.5;
        if (qualityScore < options.qualityThreshold) {
          continue;
        }

        if (options.maxSamples && mergedSamples >= options.maxSamples) {
          break;
        }

        seenIds.add(record.conversation_id);
        categories.add(record.source);

        qualitySum += qualityScore;
        qualityCount++;

        if (options.outputFormat === "jsonl") {
          writeStream.write(JSON.stringify(record) + "\n");
        }

        mergedSamples++;
      } catch (parseError) {
        logger.debug(`Skipping malformed line: ${parseError}`);
      }
    }
  }

  writeStream.end();

  const stats: DatasetMergeStats = {
    totalDatasets: datasetCount,
    totalSamples,
    mergedSamples,
    duplicatesRemoved,
    categoriesCount: categories.size,
    qualityScoreAverage: qualityCount > 0 ? qualitySum / qualityCount : 0,
    processingTimeMs: Date.now() - startTime,
  };

  logger.info("Dataset merge completed", { stats });
  return stats;
}

export function mergedDatasetExists(outputPath?: string): boolean {
  const basePath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "merged");
  const defaultFilename = "mental_health_dataset.jsonl";

  const checkPath = outputPath
    ? securePathJoin(basePath, outputPath, {
        allowedExtensions: [".jsonl", ".json", ".csv"],
      })
    : securePathJoin(basePath, defaultFilename, {
        allowedExtensions: [".jsonl", ".json", ".csv"],
      });

  const exists = existsSync(checkPath);
  logger.info("Checking merged dataset existence", { path: checkPath, exists });

  return exists;
}

export function getMergedDatasetPath(format: "jsonl" | "json" | "csv" = "jsonl"): string {
  if (format !== "jsonl" && format !== "json" && format !== "csv") {
    throw new Error("Invalid format parameter");
  }

  const extension = format === "jsonl" ? "jsonl" : format;
  const filename = `mental_health_dataset.${extension}`;

  const basePath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "merged");
  const validatedPath = securePathJoin(basePath, filename, {
    allowedExtensions: [".jsonl", ".json", ".csv"],
  });

  logger.debug("Generated merged dataset path", { format, path: validatedPath });

  return validatedPath;
}

export async function validateMergedDataset(filePath: string): Promise<{
  isValid: boolean;
  errors: string[];
  sampleCount: number;
}> {
  logger.info("Validating merged dataset", { filePath });

  const basePath = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "merged");
  const validatedPath = securePathJoin(basePath, filePath, {
    allowedExtensions: [".jsonl", ".json", ".csv"],
  });

  const errors: string[] = [];
  let sampleCount = 0;

  if (!existsSync(validatedPath)) {
    errors.push("Dataset file does not exist");
    return { isValid: false, errors, sampleCount: 0 };
  }

  try {
    const readStream = createReadStream(validatedPath, "utf-8");
    const rl = createInterface({ input: readStream, crlfDelay: Infinity });

    let lineNumber = 0;
    for await (const line of rl) {
      lineNumber++;
      if (!line.trim()) continue;

      try {
        const record = JSON.parse(line);
        if (!record.conversation_id || !Array.isArray(record.messages)) {
          errors.push(`Line ${lineNumber}: Missing required fields`);
        }
        sampleCount++;
      } catch (parseError) {
        errors.push(`Line ${lineNumber}: Invalid JSON`);
      }
    }
  } catch (error) {
    errors.push(`Read error: ${error}`);
  }

  const isValid = errors.length === 0;

  logger.info("Dataset validation completed", {
    filePath: validatedPath,
    isValid,
    sampleCount,
    errorCount: errors.length,
  });

  return { isValid, errors, sampleCount };
}
