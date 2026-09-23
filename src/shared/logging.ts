export type LogContext = Record<string, unknown>;

export type LogLevel = 'info' | 'warning' | 'error';

export function getErrorLogContext(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      ...(error.stack ? { errorStack: error.stack } : {}),
    };
  }
  if (typeof error === 'string') {
    return { errorMessage: error };
  }
  return { errorMessage: 'An unknown error occurred.' };
}
