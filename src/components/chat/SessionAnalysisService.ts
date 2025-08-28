// SessionAnalysisService.ts
/**
 * Asynchronous, non-blocking service for analyzing mental health chat sessions.
 * Calculates stats (message counts, average confidence, bias alerts, duration, persona tags, etc.)
 * Designed for background analysis; emits updates for dashboards and exports.
 */

import { ChatMessage } from './BrutalistChatDemo';

export interface SessionStats {
  totalMessages: number;
  userMessages: number;
  botMessages: number;
  systemMessages: number;
  avgConfidence: number;
  biasAlertCount: number;
  sessionDurationMinutes: number;
  personaTagCounts: Record<string, number>;
  lastUpdated: Date;
}

type Subscriber = (stats: SessionStats) => void;

export class SessionAnalysisService {
  private subscribers: Set<Subscriber> = new Set();
  private lastStats: SessionStats | null = null;
  private pending: boolean = false;

  /** Subscribe for real-time analysis updates */
  subscribe(fn: Subscriber) {
    this.subscribers.add(fn);
    if (this.lastStats) {
      fn(this.lastStats);
    }
    return () => this.subscribers.delete(fn);
  }

  /** Analyze a session asynchronously, emitting stats to all subscribers */
  async analyze(messages: ChatMessage[]) {
    if (this.pending) {
      return; // Skip overlapping runs
    }
    this.pending = true;
    // Run in background (simulate with setTimeout, or use web worker in production)
    setTimeout(() => {
      const stats = this.computeStats(messages);
      this.lastStats = stats;
      this.pending = false;
      this.emit(stats);
    }, 0);
  }

  /** Compute all relevant stats synchronously (meant for internal async trigger) */
  private computeStats(messages: ChatMessage[]): SessionStats {
    const now = new Date();
    const totalMessages = messages.length;
    let userMessages = 0, botMessages = 0, systemMessages = 0, confidenceSum = 0, confidenceCount = 0, biasAlertCount = 0;
    const personaTagCounts: Record<string, number> = {};

    messages.forEach(msg => {
      if (msg.role === 'user') {
        userMessages++;
      }
      if (msg.role === 'bot') {
        botMessages++;
      }
      if (msg.role === 'system') {
        systemMessages++;
      }
      if (msg.metadata?.confidenceScore) {
        confidenceSum += msg.metadata.confidenceScore;
        confidenceCount++;
      }
      if (msg.metadata?.biasDetected) {
        biasAlertCount++;
      }
      if (msg.personaContext?.traits) {
        msg.personaContext.traits.forEach(trait => {
          personaTagCounts[trait] = (personaTagCounts[trait] || 0) + 1;
        });
      }
    });

    const avgConfidence = confidenceCount > 0 ? Math.round(confidenceSum / confidenceCount) : 0;
    const sessionStart = messages[0]?.timestamp ? messages[0].timestamp.getTime() : Date.now();
    const sessionDurationMinutes = Math.floor((Date.now() - sessionStart) / 60000);

    return {
      totalMessages,
      userMessages,
      botMessages,
      systemMessages,
      avgConfidence,
      biasAlertCount,
      sessionDurationMinutes,
      personaTagCounts,
      lastUpdated: now,
    };
  }

  /** Trigger a manual update for dashboards if stats cached */
  public notifyIfCached() {
    if (this.lastStats) {
      this.emit(this.lastStats);
    }
  }

  private emit(stats: SessionStats) {
    for (const fn of this.subscribers) {
      try {
        fn(stats);
      } catch (e) {
        // Non-blocking error for broken dashboard
        // eslint-disable-next-line no-console
        console.error('SessionAnalysisService subscriber error:', e);
      }
    }
  }
}

export const sessionAnalysisService = new SessionAnalysisService();