import { createReadStream, createWriteStream, existsSync, mkdirSync } from "node:fs";
import { createInterface } from "node:readline";
import { pipeline } from "node:stream/promises";
import { ALLOWED_DIRECTORIES, safeJoin } from "../../../utils/path-security";
import { createBuildSafeLogger } from "../../logging/build-safe-logger";

const logger = createBuildSafeLogger("default");

export interface DatasetPaths {
  openai: string | null;
  huggingface: string | null;
}

export interface PreparedDatasetStatus {
  openai: boolean;
  huggingface: boolean;
}

export interface Pix32Record {
  conversation_id: string;
  source: string;
  messages: Array<{
    role: string;
    content: string;
    timestamp?: string;
    metadata?: Record<string, unknown>;
  }>;
  metadata: Record<string, unknown>;
}

export interface OpenAITrainingExample {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
}

export interface HuggingFaceRecord {
  conversations: Array<{ from: string; value: string }>;
  source?: string;
  quality_score?: number;
}

const SYSTEM_PROMPT = `You are an empathetic, professional mental health counselor. Respond to clients with warmth, validation, and evidence-based therapeutic techniques. Maintain appropriate boundaries while providing supportive guidance. Prioritize client safety and wellbeing.`;

export function preparedDatasetsExist(): PreparedDatasetStatus {
  const dataDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "prepared");
  const openaiPath = safeJoin(dataDir, "openai_dataset.jsonl");
  const huggingfacePath = safeJoin(dataDir, "huggingface_dataset.jsonl");

  return {
    openai: existsSync(openaiPath),
    huggingface: existsSync(huggingfacePath),
  };
}

export function mapRoleToOpenAI(role: string): "user" | "assistant" {
  const roleMap: Record<string, "user" | "assistant"> = {
    client: "user",
    user: "user",
    therapist: "assistant",
    assistant: "assistant",
  };
  return roleMap[role.toLowerCase()] || "user";
}

export function mapRoleToHuggingFace(role: string): string {
  const roleMap: Record<string, string> = {
    client: "human",
    user: "human",
    therapist: "gpt",
    assistant: "gpt",
  };
  return roleMap[role.toLowerCase()] || "human";
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

export async function prepareForOpenAI(): Promise<string | null> {
  try {
    logger.info("Preparing dataset for OpenAI fine-tuning format");

    const normalizedDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "ai", "data", "normalized");
    const outputDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "prepared");
    const outputPath = safeJoin(outputDir, "openai_dataset.jsonl");

    mkdirSync(outputDir, { recursive: true });

    let recordCount = 0;
    let skippedCount = 0;
    const writeStream = createWriteStream(outputPath, "utf-8");

    for await (const filePath of findNormalizedFiles(normalizedDir)) {
      logger.info(`Processing ${filePath}`);

      const readStream = createReadStream(filePath, "utf-8");
      const rl = createInterface({ input: readStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const record: Pix32Record = JSON.parse(line);

          const messages: OpenAITrainingExample["messages"] = [
            { role: "system", content: SYSTEM_PROMPT },
          ];

          for (const msg of record.messages) {
            messages.push({
              role: mapRoleToOpenAI(msg.role),
              content: msg.content,
            });
          }

          if (messages.length < 3) {
            skippedCount++;
            continue;
          }

          writeStream.write(JSON.stringify({ messages }) + "\n");
          recordCount++;
        } catch (parseError) {
          logger.debug(`Skipping malformed line: ${parseError}`);
          skippedCount++;
        }
      }
    }

    writeStream.end();

    logger.info(`OpenAI dataset prepared: ${recordCount} records, ${skippedCount} skipped`);
    return outputPath;
  } catch (error: unknown) {
    logger.error(`Failed to prepare OpenAI dataset: ${error}`);
    return null;
  }
}

export async function prepareForHuggingFace(): Promise<string | null> {
  try {
    logger.info("Preparing dataset for HuggingFace format");

    const normalizedDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "ai", "data", "normalized");
    const outputDir = safeJoin(ALLOWED_DIRECTORIES.PROJECT_ROOT, "data", "prepared");
    const outputPath = safeJoin(outputDir, "huggingface_dataset.jsonl");

    mkdirSync(outputDir, { recursive: true });

    let recordCount = 0;
    let skippedCount = 0;
    const writeStream = createWriteStream(outputPath, "utf-8");

    for await (const filePath of findNormalizedFiles(normalizedDir)) {
      logger.info(`Processing ${filePath}`);

      const readStream = createReadStream(filePath, "utf-8");
      const rl = createInterface({ input: readStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;

        try {
          const record: Pix32Record = JSON.parse(line);

          const conversations = record.messages.map((msg) => ({
            from: mapRoleToHuggingFace(msg.role),
            value: msg.content,
          }));

          if (conversations.length < 2) {
            skippedCount++;
            continue;
          }

          const hfRecord: HuggingFaceRecord = {
            conversations,
            source: record.source,
            quality_score: (record.metadata?.quality_score as number) ?? 0.5,
          };

          writeStream.write(JSON.stringify(hfRecord) + "\n");
          recordCount++;
        } catch (parseError) {
          logger.debug(`Skipping malformed line: ${parseError}`);
          skippedCount++;
        }
      }
    }

    writeStream.end();

    logger.info(`HuggingFace dataset prepared: ${recordCount} records, ${skippedCount} skipped`);
    return outputPath;
  } catch (error: unknown) {
    logger.error(`Failed to prepare HuggingFace dataset: ${error}`);
    return null;
  }
}

export async function prepareAllFormats(): Promise<DatasetPaths> {
  const openaiPath = await prepareForOpenAI();
  const huggingfacePath = await prepareForHuggingFace();

  return {
    openai: openaiPath,
    huggingface: huggingfacePath,
  };
}
