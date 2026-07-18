import fs from 'node:fs';

function read(path) {
  return fs.readFileSync(path, 'utf8');
}

function replaceOnce(path, from, to) {
  const content = read(path);
  if (!content.includes(from)) throw new Error(`${path}: expected source text not found`);
  if (content.indexOf(from) !== content.lastIndexOf(from)) throw new Error(`${path}: source text is not unique`);
  fs.writeFileSync(path, content.replace(from, to));
}

const namespacePath = 'blue_modules/wiiicoin-namespace.ts';
replaceOnce(
  namespacePath,
  "export const WIII_NAMESPACE_FEE_RATE = 2_000;\nexport const WIII_NAMESPACE_TRANSFER_KEY_PREFIX = '__WALLET_TRANSFER__';",
  "export const WIII_NAMESPACE_FEE_RATE = 2_000;\n// Namespace transactions in the original Wiiicoin wallet use a final input sequence.\n// Do not inherit the payment wallet's RBF sequence because the chain rejects that wire format.\nexport const WIII_NAMESPACE_SEQUENCE = 0xffffffff;\nexport const WIII_NAMESPACE_TRANSFER_KEY_PREFIX = '__WALLET_TRANSFER__';",
);
replaceOnce(
  namespacePath,
  'wallet._addPsbtInput(psbt, input, AbstractHDElectrumWallet.defaultRBFSequence, new Uint8Array([0, 0, 0, 0]));',
  'wallet._addPsbtInput(psbt, input, WIII_NAMESPACE_SEQUENCE, new Uint8Array([0, 0, 0, 0]));',
);

const errorPath = 'blue_modules/wiiicoin-namespace-error.ts';
const errorContent = `type RpcErrorLike = {
  code?: unknown;
  message?: unknown;
  error?: unknown;
  data?: unknown;
};

function sanitizeMessage(value: string): string {
  const withoutRawTransaction = value.replace(/\\n\\s*\\[[0-9a-f]{128,}\\]\\s*$/i, '').trim();
  if (withoutRawTransaction.length <= 500) return withoutRawTransaction;
  return \`${'${withoutRawTransaction.slice(0, 497)}'}...\`;
}

function stringifyValue(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) return sanitizeMessage(value);
  if (value instanceof Error && value.message.trim()) return sanitizeMessage(value.message);
  if (value && typeof value === 'object') {
    const candidate = value as RpcErrorLike;
    const nested = candidate.message ?? candidate.error ?? candidate.data;
    if (nested !== value) {
      const nestedMessage = stringifyValue(nested);
      if (nestedMessage) return nestedMessage;
    }
    try {
      const json = JSON.stringify(value);
      if (json && json !== '{}') return sanitizeMessage(json);
    } catch {}
  }
  return undefined;
}

/** Converts Electrum JSON-RPC rejections into a readable alert instead of \`[object Object]\`. */
export function formatNamespaceError(error: unknown): string {
  const message = stringifyValue(error) ?? 'Unknown namespace error.';
  if (!error || typeof error !== 'object') return message;

  const code = (error as RpcErrorLike).code;
  if (code === undefined || code === null || String(code).trim() === '') return message;
  return \`${'${message}'} (code ${'${String(code)}'})\`;
}
`;
fs.writeFileSync(errorPath, errorContent);

const testPath = 'tests/unit/wiiicoin-namespace.test.ts';
replaceOnce(
  testPath,
  '  WIII_NAMESPACE_FEE_RATE,\n  WIII_OP_DELETE,',
  '  WIII_NAMESPACE_FEE_RATE,\n  WIII_NAMESPACE_SEQUENCE,\n  WIII_OP_DELETE,',
);
replaceOnce(
  testPath,
  "  it('uses the legacy Wiiicoin data-transaction fee floor', () => {\n    expect(WIII_NAMESPACE_FEE_RATE).toBe(2_000);\n  });\n",
  "  it('uses the legacy Wiiicoin data-transaction fee floor', () => {\n    expect(WIII_NAMESPACE_FEE_RATE).toBe(2_000);\n  });\n\n  it('uses the legacy final input sequence for namespace transactions', () => {\n    expect(WIII_NAMESPACE_SEQUENCE).toBe(0xffffffff);\n  });\n",
);

fs.writeFileSync(
  'tests/unit/wiiicoin-namespace-error.test.ts',
  `import { formatNamespaceError } from '../../blue_modules/wiiicoin-namespace-error';

describe('Wiiicoin namespace errors', () => {
  it('shows a structured Electrum message and code', () => {
    expect(formatNamespaceError({ code: 1, message: 'the transaction was rejected by network rules.' })).toBe(
      'the transaction was rejected by network rules. (code 1)',
    );
  });

  it('removes a raw transaction dump from a network rejection', () => {
    const rawTransaction = '00'.repeat(274);
    expect(formatNamespaceError({ code: 1, message: \`the transaction was rejected by network rules.\\n\\n[${'${rawTransaction}'}]\` })).toBe(
      'the transaction was rejected by network rules. (code 1)',
    );
  });
});
`,
);

const auditPath = 'scripts/audit-wiiiwallet-consolidation.mjs';
replaceOnce(
  auditPath,
  "requireText(namespacePath, 'export const WIII_NAMESPACE_FEE_RATE = 2_000;', 'namespace data-transaction fee floor');\nrequireText(namespacePath, 'Math.max(WIII_NAMESPACE_FEE_RATE', 'namespace fee estimate floor');",
  "requireText(namespacePath, 'export const WIII_NAMESPACE_FEE_RATE = 2_000;', 'namespace data-transaction fee floor');\nrequireText(namespacePath, 'Math.max(WIII_NAMESPACE_FEE_RATE', 'namespace fee estimate floor');\nrequireText(namespacePath, 'export const WIII_NAMESPACE_SEQUENCE = 0xffffffff;', 'namespace final input sequence');\nrequireText(namespacePath, 'input, WIII_NAMESPACE_SEQUENCE,', 'namespace sequence applied to every input');\nforbidText(namespacePath, 'input, AbstractHDElectrumWallet.defaultRBFSequence,', 'namespace RBF input sequence');",
);
replaceOnce(
  auditPath,
  "requireFile('blue_modules/wiiicoin-namespace-error.ts');\nrequireText('blue_modules/wiiicoin-namespace-error.ts', \"json !== '{}'\", 'structured namespace RPC error formatting');",
  "requireFile('blue_modules/wiiicoin-namespace-error.ts');\nrequireFile('tests/unit/wiiicoin-namespace-error.test.ts');\nrequireText('blue_modules/wiiicoin-namespace-error.ts', \"json !== '{}'\", 'structured namespace RPC error formatting');\nrequireText('blue_modules/wiiicoin-namespace-error.ts', \"[0-9a-f]{128,}\", 'raw transaction rejection redaction');",
);

const docsPath = 'docs/WIIICOIN_NAMESPACES.md';
const docs = read(docsPath);
if (!docs.includes('## Input sequence compatibility')) {
  fs.writeFileSync(
    docsPath,
    `${'${docs.trimEnd()}'}\n\n## Input sequence compatibility\n\nNamespace transactions use the final input sequence **0xffffffff**, matching the original Wiiicoin wallet. They must not inherit the ordinary payment wallet RBF sequence. Electrum rejection alerts also omit raw transaction hex while preserving the server message and error code.\n`,
  );
}

console.log('Applied namespace final-sequence compatibility fix.');
