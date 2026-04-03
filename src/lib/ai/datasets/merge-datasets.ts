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

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function flattenRecordForCSV(record: ConversationRecord): Record<string, string> {
  const flat: Record<string, string> = {
    conversation_id: record.conversation_id,
    source: record.source,
    quality_score: String(record.metadata?.quality_score ?? 0.5),
  };

  const maxMessages = 10;
  for (let i = 0; i < maxMessages; i++) {
    const msg = record.messages[i];
    if (msg) {
      flat[`message_${i}_role`] = msg.role;
      flat[`message_${i}_content`] = msg.content.replace(/"/g, '""').replace(/\n/g, "\\n");
    } else {
      flat[`message_${i}_role`] = "";
      flat[`message_${i}_content`] = "";
    }
  }

  return flat;
}

function generateCSVHeaders(): string[] {
  const headers = ["conversation_id", "source", "quality_score"];
  for (let i = 0; i < 10; i++) {
    headers.push(`message_${i}_role`, `message_${i}_content`);
  }
  return headers;
}

function recordToCSVRow(record: ConversationRecord, headers: string[]): string {
  const flat = flattenRecordForCSV(record);
  const values = headers.map((h) => {
    const val = flat[h] ?? "";
    return `"${val}"`;
  });
  return values.join(",");
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

  const csvHeaders = generateCSVHeaders();

  if (options.outputFormat === "csv") {
    writeStream.write(csvHeaders.map((h) => `"${h}"`).join(",") + "\n");
  }

  if (options.outputFormat === "json") {
    writeStream.write("[\n");
  }

  let reachedMaxSamples = false;

  outerLoop: for await (const filePath of findNormalizedFiles(normalizedDir)) {
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
          reachedMaxSamples = true;
          break outerLoop;
        }

        seenIds.add(record.conversation_id);
        categories.add(record.source);

        qualitySum += qualityScore;
        qualityCount++;

        switch (options.outputFormat) {
          case "jsonl":
            writeStream.write(JSON.stringify(record) + "\n");
            break;
          case "json":
            if (mergedSamples > 0) {
              writeStream.write(",\n");
            }
            writeStream.write("  " + JSON.stringify(record));
            break;
          case "csv":
            writeStream.write(recordToCSVRow(record, csvHeaders) + "\n");
            break;
        }

        mergedSamples++;
      } catch (parseError) {
        logger.debug(`Skipping malformed line: ${parseError}`);
      }
    }
  }

  if (reachedMaxSamples) {
    logger.info(`Reached maxSamples limit: ${options.maxSamples}`);
  }

  if (options.outputFormat === "json") {
    writeStream.write("\n]");
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

async function validateJSONDataset(filePath: string, errors: string[]): Promise<number> {
  const readStream = createReadStream(filePath, "utf-8");
  const rl = createInterface({ input: readStream, crlfDelay: Infinity });

  let lineNumber = 0;
  let sampleCount = 0;
  let currentRecord = "";
  let braceDepth = 0;
  let inString = false;
  let escapeNext = false;

  for await (const line of rl) {
    lineNumber++;

    const trimmed = line.trim();

    if (lineNumber === 1 && trimmed === "[") continue;
    if (trimmed === "]") break;
    if (trimmed === "," || trimmed === "") continue;

    const recordLine = trimmed.startsWith(",") ? trimmed.slice(1).trim() : trimmed;

    for (let i = 0; i < recordLine.length; i++) {
      const char = recordLine[i];

      if (escapeNext) {
        currentRecord += char;
        escapeNext = false;
        continue;
      }

      if (char === "\\") {
        currentRecord += char;
        escapeNext = true;
        continue;
      }

      if (char === '"' && !escapeNext) {
        inString = !inString;
        currentRecord += char;
        continue;
      }

      currentRecord += char;

      if (!inString) {
        if (char === "{") braceDepth++;
        if (char === "}") braceDepth--;
      }
    }

    if (braceDepth === 0 && currentRecord.trim()) {
      try {
        const record = JSON.parse(currentRecord.trim());
        if (!record.conversation_id || !Array.isArray(record.messages)) {
          errors.push(`Record near line ${lineNumber}: Missing required fields`);
        }
        sampleCount++;
      } catch {
        errors.push(`Record near line ${lineNumber}: Invalid JSON`);
      }
      currentRecord = "";
      inString = false;
      escapeNext = false;
    }
  }

  return sampleCount;
}

async function validateCSVDataset(filePath: string, errors: string[]): Promise<number> {
  const readStream = createReadStream(filePath, "utf-8");
  const rl = createInterface({ input: readStream, crlfDelay: Infinity });

  let lineNumber = 0;
  let headers: string[] = [];
  let sampleCount = 0;

  for await (const line of rl) {
    lineNumber++;

    if (lineNumber === 1) {
      headers = parseCSVLine(line).map((h) => h.trim());
      if (!headers.includes("conversation_id")) {
        errors.push("CSV missing required column: conversation_id");
      }
      continue;
    }

    if (!line.trim()) continue;

    const values = parseCSVLine(line);
    if (values.length !== headers.length) {
      errors.push(
        `Line ${lineNumber}: Column count mismatch (expected ${headers.length}, got ${values.length})`,
      );
    }
    sampleCount++;
  }

  return sampleCount;
}

async function validateJSONLDataset(filePath: string, errors: string[]): Promise<number> {
  const readStream = createReadStream(filePath, "utf-8");
  const rl = createInterface({ input: readStream, crlfDelay: Infinity });

  let lineNumber = 0;
  let sampleCount = 0;

  for await (const line of rl) {
    lineNumber++;
    if (!line.trim()) continue;

    try {
      const record = JSON.parse(line);
      if (!record.conversation_id || !Array.isArray(record.messages)) {
        errors.push(`Line ${lineNumber}: Missing required fields`);
      }
      sampleCount++;
    } catch {
      errors.push(`Line ${lineNumber}: Invalid JSON`);
    }
  }

  return sampleCount;
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

  if (!existsSync(validatedPath)) {
    errors.push("Dataset file does not exist");
    return { isValid: false, errors, sampleCount: 0 };
  }

  const extension = validatedPath.split(".").pop()?.toLowerCase();

  let sampleCount = 0;

  try {
    switch (extension) {
      case "json":
        sampleCount = await validateJSONDataset(validatedPath, errors);
        break;
      case "csv":
        sampleCount = await validateCSVDataset(validatedPath, errors);
        break;
      default:
        sampleCount = await validateJSONLDataset(validatedPath, errors);
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
