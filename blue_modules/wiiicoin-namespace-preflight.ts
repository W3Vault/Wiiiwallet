import * as BlueElectrum from './BlueElectrum';
import { WIIICOIN_ELECTRUM_SERVER } from './wiiicoin-network';

const ElectrumClient = require('electrum-client');
const net = require('net');
const tls = require('tls');

type NamespacePreflightClient = {
  initElectrum(config: { client: string; version: string }, policy?: { maxRetry: number; callback: () => void }): Promise<unknown>;
  request(method: string, params: unknown[]): Promise<unknown>;
  close(): void;
  onError?: (error: { message?: string }) => void;
};

type MempoolAcceptRecord = Record<string, unknown> & {
  allowed?: boolean;
  reason?: unknown;
};

export class NamespaceMempoolRejectedError extends Error {
  readonly rejectReason: string;

  constructor(reason: string) {
    super(`Wiiicoin Core rejected the namespace transaction: ${reason}`);
    this.name = 'NamespaceMempoolRejectedError';
    this.rejectReason = reason;
  }
}

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/**
 * Extracts the node's normalized reject reason from ElectrumX protocol 1.7.
 * ElectrumX maps Core's reject-details / reject-reason fields to `reason`.
 */
export function namespaceMempoolRejectReason(response: unknown): string | undefined {
  const item = Array.isArray(response) ? response[0] : response;
  if (!item || typeof item !== 'object') return undefined;

  const result = item as MempoolAcceptRecord;
  if (result.allowed !== false) return undefined;

  return (
    nonEmptyText(result.reason) ??
    nonEmptyText(result['reject-details']) ??
    nonEmptyText(result['reject-reason']) ??
    nonEmptyText(result['package-error']) ??
    'Rejected by Wiiicoin Core without a detailed reason.'
  );
}

async function connectPreflightElectrum(): Promise<NamespacePreflightClient> {
  const preferred = await BlueElectrum.getPreferredServer();
  const host = preferred?.host ?? WIIICOIN_ELECTRUM_SERVER.host;
  const ssl = preferred?.host ? preferred.ssl : WIIICOIN_ELECTRUM_SERVER.ssl;
  const tcp = preferred?.host ? preferred.tcp : undefined;
  const port = ssl ?? tcp;
  if (!port) throw new Error('No Wiiicoin Electrum server is configured.');

  const client: NamespacePreflightClient = new ElectrumClient(net, tls, port, host, ssl ? 'tls' : 'tcp');
  client.onError = () => {};
  await client.initElectrum({ client: 'Wiiiwallet namespace preflight', version: '1.7' }, { maxRetry: 0, callback: () => {} });
  return client;
}

/**
 * Tests a signed namespace transaction against Wiiicoin Core without adding it
 * to the mempool. Older ElectrumX servers do not expose this protocol-1.7 call;
 * in that case the normal broadcast path remains available.
 */
export async function preflightNamespaceTransaction(rawTransaction: string): Promise<void> {
  if (!/^[0-9a-f]+$/i.test(rawTransaction) || rawTransaction.length % 2 !== 0) {
    throw new Error('Invalid raw namespace transaction.');
  }

  let client: NamespacePreflightClient | undefined;
  try {
    client = await connectPreflightElectrum();
    const response = await client.request('blockchain.transaction.testmempoolaccept', [[rawTransaction]]);
    const reason = namespaceMempoolRejectReason(response);
    if (reason) throw new NamespaceMempoolRejectedError(reason);
  } catch (error) {
    if (error instanceof NamespaceMempoolRejectedError) throw error;
    // Preflight is an optional diagnostic layer. Protocol negotiation, method
    // availability or a transient second connection must not replace the
    // existing broadcast path on older servers.
  } finally {
    try {
      client?.close();
    } catch {}
  }
}
