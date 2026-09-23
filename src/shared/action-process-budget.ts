export const DEFAULT_ACTION_PROCESS_BUDGET_MS = 20_000;

export type ActionProcessClock = () => number;

export interface ActionProcessBudgetOptions {
  durationMs?: number;
  now?: ActionProcessClock;
}

export interface ActionProcessBudget {
  canContinue(reserveMs?: number): boolean;
}

function requirePositiveDuration(durationMs: number): void {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    throw new Error('Action process budget duration must be positive.');
  }
}

function requireValidReserve(reserveMs: number): void {
  if (!Number.isFinite(reserveMs) || reserveMs < 0) {
    throw new Error('Action process budget reserve cannot be negative.');
  }
}

export function createActionProcessBudget(
  options: ActionProcessBudgetOptions = {},
): ActionProcessBudget {
  const durationMs = options.durationMs ?? DEFAULT_ACTION_PROCESS_BUDGET_MS;
  const now = options.now ?? Date.now;
  requirePositiveDuration(durationMs);

  const startedAtMs = now();
  const deadlineMs = startedAtMs + durationMs;
  let latestObservedAtMs = startedAtMs;
  const remainingMs = (): number => {
    latestObservedAtMs = Math.max(latestObservedAtMs, now());
    return Math.max(0, deadlineMs - latestObservedAtMs);
  };

  return {
    canContinue(reserveMs = 0): boolean {
      requireValidReserve(reserveMs);
      return remainingMs() > reserveMs;
    },
  };
}
