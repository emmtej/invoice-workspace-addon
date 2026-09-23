import type { LogContext, LogLevel } from '../shared/logging';

export function logEvent(
  event: string,
  level: LogLevel,
  context: LogContext = {},
): void {
  if (typeof console === 'undefined' || typeof console.log !== 'function') {
    return;
  }

  try {
    console.log(JSON.stringify({ ...context, event, level }));
  } catch (_error) {
    // Logging must never change add-on behavior.
  }
}
