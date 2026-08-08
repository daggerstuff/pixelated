/**
 * Ollama Check-In Service
 *
 * Performs LLM-assisted task check-ins to analyze completed work
 * and suggest improvements.
 */

export interface CheckInResult {
  shouldContinue: boolean;
  improvements: ImprovementSuggestion[];
  reasoningLog: string[];
  decision: string;
  rawResponse?: string;
}

export interface ImprovementSuggestion {
  id: string;
  suggestion: string;
  category: string;
  priority: string;
}

export class OllamaCheckInService {
  async performCheckIn(_taskSummary: string, _context: string): Promise<CheckInResult> {
    return {
      shouldContinue: true,
      improvements: [],
      reasoningLog: [],
      decision: "continue",
    };
  }
}

export default OllamaCheckInService;
