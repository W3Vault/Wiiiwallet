type RpcErrorLike = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
  data?: unknown;
  reason?: unknown;
  details?: unknown;
  'reject-reason'?: unknown;
  'reject-details'?: unknown;
};

function sanitizeMessage(value: string): string {
  const trimmed = value.trim();
  if (/^\[?[0-9a-f]{128,}\]?$/i.test(trimmed)) return '';

  const withoutRawTransaction = trimmed
    .replace(/\n?\s*\[[0-9a-f]{128,}\]\s*/gi, '\n')
    .replace(/\b[0-9a-f]{256,}\b/gi, '')
    .trim();

  if (withoutRawTransaction.length <= 500) return withoutRawTransaction;
  return `${withoutRawTransaction.slice(0, 497)}...`;
}

function collectMessages(value: unknown, messages: string[], seen: Set<unknown>): void {
  if (value === undefined || value === null || seen.has(value)) return;

  if (typeof value === 'string') {
    const message = sanitizeMessage(value);
    if (message && !messages.includes(message)) messages.push(message);
    return;
  }

  if (value instanceof Error) {
    collectMessages(value.message, messages, seen);
    return;
  }

  if (typeof value !== 'object') return;
  seen.add(value);

  const candidate = value as RpcErrorLike;
  for (const nested of [
    candidate.message,
    candidate.error,
    candidate.data,
    candidate.reason,
    candidate.details,
    candidate['reject-reason'],
    candidate['reject-details'],
  ]) {
    collectMessages(nested, messages, seen);
  }
}

/** Converts Electrum JSON-RPC rejections into a readable alert instead of `[object Object]`. */
export function formatNamespaceError(error: unknown): string {
  const messages: string[] = [];
  collectMessages(error, messages, new Set());
  const message = messages.join('\n') || 'Unknown namespace error.';
  if (!error || typeof error !== 'object') return message;

  const code = (error as RpcErrorLike).code;
  if (code === undefined || code === null || String(code).trim() === '') return message;
  return `${message} (code ${String(code)})`;
}
