import {
  access,
  appendFile,
  mkdir,
  readFile,
  rename,
  stat,
  unlink,
  writeFile,
} from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";

import type {
  TurnQuery,
  TurnSubmissionFailure,
  TurnSubmissionResult,
} from "./store";
import { InMemoryTurnLedger } from "./store";
import type { NoteTurn } from "./turn-log";
import type { HandoffPolicy } from "./route";

type PersistedLedgerFile = {
  version: 1;
  createdAt: string;
  turns: NoteTurn[];
};

type PersistentTurnLedgerOptions = {
  filePath?: string;
  policy?: HandoffPolicy;
};

type StoredTurnsReadResult = {
  turns: NoteTurn[];
  hasValidSnapshot: boolean;
};

const DEFAULT_LEDGER_FILE = path.resolve(process.cwd(), "data", "agent-note-collab", "turns.json");
const LEDGER_FILE_VERSION = 1;
const JOURNAL_FILE_SUFFIX = ".journal";
const LOCK_FILE_SUFFIX = ".lock";
const LOCK_STALE_MS = 30_000;
const LOCK_RETRY_DELAY_MS = 75;
const LOCK_MAX_RETRIES = 200;
const COMPACTION_AFTER_BYTES = 2_097_152;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNoteTurn(value: unknown): value is NoteTurn {
  const candidate = value as NoteTurn;
  return (
    !!candidate &&
    typeof candidate.turnId === "string" &&
    typeof candidate.artifactId === "string" &&
    typeof candidate.phase === "string" &&
    typeof candidate.role === "string" &&
    typeof candidate.agentId === "string" &&
    typeof candidate.decision === "string" &&
    Array.isArray(candidate.assumptions) &&
    Array.isArray(candidate.openQuestions) &&
    Array.isArray(candidate.evidence)
  );
}

function isLockAcquisitionError(error: unknown): boolean {
  return typeof error === "object" && error !== null && ((error as NodeJS.ErrnoException).code === "EEXIST" || (error as NodeJS.ErrnoException).code === "EAGAIN");
}

async function readStoredTurns(filePath: string): Promise<StoredTurnsReadResult> {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    return { turns: [], hasValidSnapshot: false };
  }

  const raw = (await readFile(filePath, "utf8")).trim();
  if (!raw) {
    return { turns: [], hasValidSnapshot: false };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<PersistedLedgerFile> | NoteTurn[];
    if (Array.isArray(parsed)) {
      return { turns: parsed.filter(isNoteTurn), hasValidSnapshot: true };
    }

    const payload = parsed as Partial<PersistedLedgerFile>;
    if (
      payload.version === LEDGER_FILE_VERSION &&
      Array.isArray(payload.turns)
    ) {
      return { turns: payload.turns.filter(isNoteTurn), hasValidSnapshot: true };
    }

    return { turns: [], hasValidSnapshot: false };
  } catch {
    return { turns: [], hasValidSnapshot: false };
  }
}

async function readJournalTurns(filePath: string): Promise<NoteTurn[]> {
  try {
    await access(filePath, constants.F_OK);
  } catch {
    return [];
  }

  const raw = (await readFile(filePath, "utf8")).trim();
  if (!raw) return [];

  const lines = raw.split("\n");
  const turns: NoteTurn[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (isNoteTurn(parsed)) turns.push(parsed);
    } catch {
      continue;
    }
  }

  return turns;
}

function toPersistedPayload(turns: NoteTurn[]): PersistedLedgerFile {
  return {
    version: LEDGER_FILE_VERSION,
    createdAt: new Date().toISOString(),
    turns,
  };
}

function toPersistedLedgerPath(providedPath?: string): string {
  return providedPath ? path.resolve(providedPath) : DEFAULT_LEDGER_FILE;
}

export class PersistentTurnLedger {
  private readonly storagePath: string;
  private readonly memoryLedger: InMemoryTurnLedger;
  private readonly initialization: Promise<void>;
  private readonly lockPath: string;
  private readonly journalPath: string;
  private readonly compactAfterBytes: number;
  private journalByteSize: number;
  private hasValidSnapshot: boolean;

  constructor(options?: PersistentTurnLedgerOptions) {
    this.storagePath = toPersistedLedgerPath(options?.filePath);
    const policy: HandoffPolicy = options?.policy ?? {
      minimumConfidenceForHandoff: 0.75,
      escalateOnOpenQuestions: 3,
      escalateOnMissingEvidence: true,
      maxRetriesBeforeEscalation: 2,
    };

    this.memoryLedger = new InMemoryTurnLedger({ policy });
    this.initialization = this.loadFromDisk();
    this.lockPath = `${this.storagePath}${LOCK_FILE_SUFFIX}`;
    this.journalPath = `${this.storagePath}${JOURNAL_FILE_SUFFIX}`;
    const configuredThreshold = process.env["AGENT_NOTE_COLLAB_LEDGER_COMPACT_AFTER_BYTES"];
    const fallbackValue = COMPACTION_AFTER_BYTES;
    const parsedThreshold = configuredThreshold ? Number.parseInt(configuredThreshold, 10) : fallbackValue;
    this.compactAfterBytes = Number.isNaN(parsedThreshold) || parsedThreshold <= 0 ? fallbackValue : parsedThreshold;
    this.journalByteSize = 0;
    this.hasValidSnapshot = false;
  }

  private async ensureDirectory(): Promise<void> {
    await mkdir(path.dirname(this.storagePath), { recursive: true });
  }

  private async getFileSize(filePath: string): Promise<number> {
    try {
      const stats = await stat(filePath);
      return stats.size;
    } catch {
      return 0;
    }
  }

  private async withFileLock<T>(operation: () => Promise<T>): Promise<T> {
    const lockToken = `${process.pid}-${Date.now()}`;
    let attempt = 0;
    const deadline = Date.now() + LOCK_STALE_MS * 2;

    while (attempt < LOCK_MAX_RETRIES) {
      try {
        await writeFile(this.lockPath, lockToken, { flag: "wx" });
        try {
          return await operation();
        } finally {
          await unlink(this.lockPath).catch(() => {
            // Ignore lock cleanup races with other processes.
          });
        }
      } catch (error) {
        if (!isLockAcquisitionError(error)) {
          throw error;
        }

        if (Date.now() > deadline) {
          try {
            const lockStats = await stat(this.lockPath);
            const lockAgeMs = Date.now() - lockStats.mtimeMs;
            if (lockAgeMs > LOCK_STALE_MS) {
              await unlink(this.lockPath);
            }
          } catch {
            // Lock was already removed while racing.
          }
        }

        attempt += 1;
        await sleep(LOCK_RETRY_DELAY_MS * attempt);
      }
    }

    throw new Error("Persistent ledger lock acquisition timed out.");
  }

  private async persistSnapshot(): Promise<void> {
    const turns = this.memoryLedger.list();
    const payload = toPersistedPayload(turns);
    const nextPath = `${this.storagePath}.next`;
    await writeFile(nextPath, JSON.stringify(payload), "utf8");
    await rename(nextPath, this.storagePath);
  }

  private async compactIfNeeded(): Promise<void> {
    if (this.journalByteSize <= this.compactAfterBytes) {
      return;
    }

    const liveJournalSize = await this.getFileSize(this.journalPath);
    this.journalByteSize = liveJournalSize;
    if (liveJournalSize <= this.compactAfterBytes) {
      return;
    }

    // Only rewrite the ledger file during compaction
    await this.persistSnapshot();
    // Clear the journal after compaction
    const nextJournalPath = `${this.journalPath}.next`;
    await writeFile(nextJournalPath, "", "utf8");
    await rename(nextJournalPath, this.journalPath);
    this.journalByteSize = 0;
  }

  private async persistSnapshotIfRequired(): Promise<void> {
    if (this.hasValidSnapshot) return;
    await this.persistSnapshot();
    this.hasValidSnapshot = true;
  }

  private async writeTurnToJournal(turn: NoteTurn): Promise<void> {
    await this.appendToJournal(turn);
    if (!this.hasValidSnapshot) {
      await this.persistSnapshotIfRequired();
      this.journalByteSize = await this.getFileSize(this.journalPath);
    }
    if (this.journalByteSize > this.compactAfterBytes) {
      await this.compactIfNeeded();
    }
  }

  private async appendToJournal(turn: NoteTurn): Promise<void> {
    const record = JSON.stringify(turn);
    const line = `${record}\n`;
    await appendFile(this.journalPath, line, "utf8");
    this.journalByteSize += Buffer.byteLength(line, "utf8");
  }

  private async loadFromDisk(): Promise<void> {
    await this.ensureDirectory();
    const { turns: storedTurns, hasValidSnapshot } = await readStoredTurns(this.storagePath);
    this.hasValidSnapshot = hasValidSnapshot;
    const journalTurns = await readJournalTurns(this.journalPath);
    this.journalByteSize = await this.getFileSize(this.journalPath);

    const loadedTurns: NoteTurn[] = [];
    for (const turn of storedTurns) {
      loadedTurns.push(turn);
    }
    for (const turn of journalTurns) {
      loadedTurns.push(turn);
    }

    const seenTurns = new Map<string, NoteTurn>();
    const orderedTurnIds: string[] = [];
    for (const turn of loadedTurns) {
      if (!seenTurns.has(turn.turnId)) {
        orderedTurnIds.push(turn.turnId);
      }
      seenTurns.set(turn.turnId, turn);
    }

    for (const turnId of orderedTurnIds) {
      const turn = seenTurns.get(turnId);
      if (turn === undefined) {
        continue;
      }
      try {
        this.memoryLedger.append(turn);
      } catch {
        // Skip corrupted persisted entries while preserving valid history.
      }
    }

  }

  async append(turn: NoteTurn): Promise<void> {
    await this.initialization;
    this.memoryLedger.append(turn);
    await this.withFileLock(async () => {
      await this.writeTurnToJournal(turn);
    });
  }

  async list(query?: TurnQuery): Promise<NoteTurn[]> {
    await this.initialization;
    return this.memoryLedger.list(query);
  }

  async nextTurnIdForArtifact(artifactId: string): Promise<string> {
    await this.initialization;
    return this.memoryLedger.nextTurnIdForArtifact(artifactId);
  }

  async getById(turnId: string): Promise<NoteTurn | undefined> {
    await this.initialization;
    return this.memoryLedger.getById(turnId);
  }

  async replayByArtifact(artifactId: string, asOf?: string): Promise<NoteTurn[]> {
    await this.initialization;
    return this.memoryLedger.replayByArtifact(artifactId, asOf);
  }

  async openQuestionCount(artifactId: string): Promise<number> {
    await this.initialization;
    return this.memoryLedger.openQuestionCount(artifactId);
  }

  async submitTurn(
    input: Parameters<typeof this.memoryLedger.submitTurn>[0],
  ): Promise<TurnSubmissionResult | TurnSubmissionFailure> {
    await this.initialization;
    const result = this.memoryLedger.submitTurn(input);

    if (result.ok) {
      await this.withFileLock(async () => {
        await this.writeTurnToJournal(result.turn);
      });
      return result;
    }

    return result;
  }

  get filePath(): string {
    return this.storagePath;
  }
}
