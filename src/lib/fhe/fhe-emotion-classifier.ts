import { createBuildSafeLogger } from "../logging/build-safe-logger";
import {
  EmotionClassifier,
  EmotionClassificationResult,
  EmotionTrajectory,
} from "../memory/emotion-classifier";
import {
  FHEOperation,
  type EncryptedData,
  type FHEService,
  type FHEOperationResult,
} from "./types";

const logger = createBuildSafeLogger("fhe-emotion-classifier");

const BATCH_SIZE_LIMIT = 50;
const BATCH_CONCURRENCY_LIMIT = 10;

export class FHEEmotionClassifier {
  private readonly classifier: EmotionClassifier;

  constructor(private readonly fheService: FHEService) {
    this.classifier = new EmotionClassifier();
  }

  private async encrypt(text: string): Promise<EncryptedData> {
    return this.fheService.encrypt(text);
  }

  private async decrypt(encrypted: EncryptedData): Promise<string> {
    const result = await this.fheService.decrypt(encrypted);
    return String(result);
  }

  async classify(text: string, multiLabel = true): Promise<EmotionClassificationResult> {
    logger.info("Starting FHE emotion classification");

    const encryptedText = await this.encrypt(text);
    const encryptedStr = JSON.stringify(encryptedText);

    const processEncrypted = this.fheService.processEncrypted?.bind(this.fheService);
    if (!processEncrypted) {
      throw new Error("FHE service does not support encrypted processing");
    }

    const opResult = await processEncrypted(encryptedStr, FHEOperation.EMOTION_CLASSIFY, {
      multiLabel,
    });

    if (!opResult.success) {
      const errMsg = typeof opResult.error === "string" ? opResult.error : "Unknown error";
      throw new Error(`FHE emotion classification failed: ${errMsg}`);
    }

    let encryptedResult: EncryptedData;
    if (typeof opResult.result === "string") {
      try {
        encryptedResult = JSON.parse(opResult.result) as EncryptedData;
      } catch {
        throw new Error("FHE emotion classification failed: invalid result format");
      }
    } else {
      encryptedResult = opResult.result as unknown as EncryptedData;
    }

    const decryptedStr = await this.decrypt(encryptedResult);
    let result: EmotionClassificationResult;
    try {
      result = JSON.parse(decryptedStr) as EmotionClassificationResult;
    } catch {
      throw new Error("FHE emotion classification failed: corrupted result");
    }

    logger.info("FHE emotion classification completed");
    return result;
  }

  async classifyBatch(texts: string[], multiLabel = true): Promise<EmotionClassificationResult[]> {
    if (texts.length === 0) return [];

    if (texts.length > BATCH_SIZE_LIMIT) {
      logger.warn(`Batch size ${texts.length} exceeds limit ${BATCH_SIZE_LIMIT}, truncating`);
      texts = texts.slice(0, BATCH_SIZE_LIMIT);
    }

    // Encrypt all texts in batch
    const encryptedTexts = await this.fheService.encryptBatch(texts);
    const encryptedStrings = encryptedTexts.map((et) => JSON.stringify(et));

    // Process all encrypted texts with concurrency limit
    const batches: string[][] = [];
    for (let i = 0; i < encryptedStrings.length; i += BATCH_CONCURRENCY_LIMIT) {
      batches.push(encryptedStrings.slice(i, i + BATCH_CONCURRENCY_LIMIT));
    }

    const encryptedResults: FHEOperationResult<string>[] = [];
    for (const batch of batches) {
      const batchResults = await Promise.all(
        batch.map(async (encryptedStr) => {
          if (!this.fheService.processEncrypted) {
            throw new Error("FHE service does not support encrypted processing");
          }
          return this.fheService.processEncrypted(encryptedStr, FHEOperation.EMOTION_CLASSIFY, {
            multiLabel,
          });
        }),
      );
      encryptedResults.push(...batchResults);
    }

    // Check for processing errors and extract the encrypted data
    const encryptedDataResults: EncryptedData<string>[] = [];
    for (const result of encryptedResults) {
      if (!result.success) {
        throw new Error(`FHE emotion classification failed: ${result.error ?? "Unknown error"}`);
      }
      if (!result.result) {
        throw new Error("FHE emotion classification failed: missing result");
      }
      let encryptedResult: EncryptedData<string>;
      if (typeof result.result === "string") {
        try {
          encryptedResult = JSON.parse(result.result) as EncryptedData<string>;
        } catch {
          throw new Error("FHE emotion classification failed: invalid result format");
        }
      } else {
        encryptedResult = result.result;
      }
      encryptedDataResults.push(encryptedResult);
    }

    // Decrypt all results
    const decryptedStrings = await this.fheService.decryptBatch<string>(encryptedDataResults);

    // Parse the decrypted strings into EmotionClassificationResult objects
    const results: EmotionClassificationResult[] = [];
    for (const decryptedStr of decryptedStrings) {
      try {
        const result = JSON.parse(decryptedStr) as EmotionClassificationResult;
        results.push(result);
      } catch {
        throw new Error("FHE emotion classification failed: corrupted result");
      }
    }

    return results;
  }

  sessionTrajectory(results: EmotionClassificationResult[]): EmotionTrajectory {
    return this.classifier.sessionTrajectory(results);
  }
}

export function createEmotionClassifierFHEService(fheService: FHEService): FHEEmotionClassifier {
  return new FHEEmotionClassifier(fheService);
}
