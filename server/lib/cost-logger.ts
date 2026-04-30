import { logApiCost } from "./db.js";

export type CostService = "wavespeed" | "claude" | "fonnte";

interface LogCostParams {
  phone?: string;
  service: CostService;
  operation: string;
  model?: string;
  costUsd: number;
  inputTokens?: number;
  outputTokens?: number;
  metadata?: Record<string, unknown>;
}

export function logCost(params: LogCostParams): void {
  logApiCost(params);
}

// Seedream v4.5 edit: $0.04/image
export function calculateWaveSpeedImageCost(): number {
  return 0.04;
}

// Music generation: $0.10/generation
export function calculateLyriaCost(): number {
  return 0.10;
}

// Claude pricing per token
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  "claude-sonnet-4-6": { input: 3 / 1_000_000, output: 15 / 1_000_000 },
  "claude-haiku-4-5-20251001": { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
};

export function calculateClaudeCost(model: string, inputTokens: number, outputTokens: number): number {
  const pricing = CLAUDE_PRICING[model] ?? CLAUDE_PRICING["claude-sonnet-4-6"];
  return inputTokens * pricing.input + outputTokens * pricing.output;
}
