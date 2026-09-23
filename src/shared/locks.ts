export interface TryLock {
  tryLock(timeoutMs: number): boolean;
  releaseLock(): void;
}

export function runWithTryLock<T>(
  lock: TryLock,
  timeoutMs: number,
  contentionMessage: string,
  operation: () => T,
): T {
  if (!lock.tryLock(timeoutMs)) {
    throw new Error(contentionMessage);
  }
  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}
