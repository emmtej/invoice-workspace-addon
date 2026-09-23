import { runWithTryLock } from '../../shared/locks';

export function runWithAppsScriptScriptLock<T>(
  timeoutMs: number,
  contentionMessage: string,
  operation: () => T,
): T {
  return runWithTryLock(
    LockService.getScriptLock(),
    timeoutMs,
    contentionMessage,
    operation,
  );
}

export function runWithAppsScriptUserLock<T>(
  timeoutMs: number,
  contentionMessage: string,
  operation: () => T,
): T {
  return runWithTryLock(
    LockService.getUserLock(),
    timeoutMs,
    contentionMessage,
    operation,
  );
}
