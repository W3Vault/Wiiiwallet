type RpcErrorLike = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
  data?: unknown;
};

function stringifyValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value instanceof Error && value.message.trim()) return value.message.trim();
  if (value && typeof value === 'object') {
    const candidate = value as RpcErrorLike;
    const nested = candidate.message ?? candidate.error ?? candidate.data;
    if (nested !== value) {
      const nestedMessage = stringifyValue(nested);
      if (nestedMessage) return nestedMessage;
    }
    try {
      const json = JSON.stringify(value);
      if (json && json !== '{}') return json;
    } catch {}
  }
  return undefined;
}

/** Converts Electrum JSON-RPC rejections into a readable alert instead of `[object Object]`. */
export function formatNamespaceError(error: unknown): string {
  const message = stringifyValue(error) ?? 'Unknown namespace error.';
  if (!error || typeof error !== 'object') return message;

  const code = (error as RpcErrorLike).code;
  if (code === undefined || code === null || String(code).trim() === '') return message;
  return `${message} (code ${String(code)})`;
}
