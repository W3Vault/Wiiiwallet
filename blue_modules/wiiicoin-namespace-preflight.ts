import * as BlueElectrum from './BlueElectrum';
import { formatNamespaceError } from './wiiicoin-namespace-error';
import { WIIICOIN_ELECTRUM_SERVER } from './wiiicoin-network';

const ElectrumClient = require('electrum-client');
const net = require('net');
const tls = require('tls');

type NamespacePreflightClient = {
  initElectrum(
    config: { client: string; version: string | [string, string] },
    policy?: { maxRetry: number; callback: () => void },
  ): Promise<unknown>;
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

export class NamespacePreflightUnavailableError extends Error {
  constructor(detail: string) {
    super(`Namespace preflight could not run: ${detail}`);
    this.name = 'NamespacePreflightUnavailableError';
  }
}

function nonEmptyText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function mempoolAcceptRecord(response: unknown): MempoolAcceptRecord | undefined {
  const item = Array.isArray(response) ? response[0] : response;
  return item && typeof item === 'object' ? (item as MempoolAcceptRecord) : undefined;
}

/**
 * Extracts the node's normalized reject reason from ElectrumX protocol 1.7.
 * ElectrumX maps Core's reject-details / reject-reason fields to `reason`.
 */
export function namespaceMempoolRejectReason(response: unknown): string | undefined {
  const result = mempoolAcceptRecord(response);
  if (!result || result.allowed !== false) return undefined;

  return (
    nonEmptyText(result.reason) ??
    nonEmptyText(result['reject-details']) ??
    nonEmptyText(result['reject-reason']) ??
    nonEmptyText(result['package-error']) ??
    'Rejected by Wiiicoin Core without a detailed reason.'
  );
}

export function namespacePreflightNegotiatedProtocol(response: unknown): string | undefined {
  if (!Array.isArray(response) || response.length < 2) return undefined;
  return nonEmptyText(response[1]);
}

async function connectPreflightElectrum(): Promise<{ client: NamespacePreflightClient; protocol: string }> {
  const preferred = await BlueElectrum.getPreferredServer();
  const host = preferred?.host ?? WIIICOIN_ELECTRUM_SERVER.host;
  const ssl = preferred?.host ? preferred.ssl : WIIICOIN_ELECTRUM_SERVER.ssl;
  const tcp = preferred?.host ? preferred.tcp : undefined;
  const port = ssl ?? tcp;
  if (!port) throw new NamespacePreflightUnavailableError('No Wiiicoin Electrum server is configured.');

  const client: NamespacePreflightClient = new ElectrumClient(net, tls, port, host, ssl ? 'tls' : 'tcp');
  client.onError = () => {};

  try {
    const versionResponse = await client.initElectrum(
      { client: 'Wiiiwallet namespace preflight', version: ['1.7', '1.7'] },
      { maxRetry: 0, callback: () => {} },
    );
    const protocol = namespacePreflightNegotiatedProtocol(versionResponse);
    if (protocol !== '1.7' && protocol !== '1.7.0') {
      throw new NamespacePreflightUnavailableError(
        protocol ? `ElectrumX negotiated protocol ${protocol}; protocol 1.7 is required.` : 'ElectrumX did not report its negotiated protocol.',
      );
    }
    return { client, protocol };
  } catch (error) {
    try {
      client.close();
    } catch {}
    if (error instanceof NamespacePreflightUnavailableError) throw error;
    throw new NamespacePreflightUnavailableError(formatNamespaceError(error));
  }
}

/**
 * Tests a signed namespace transaction against Wiiicoin Core without adding it
 * to the mempool. Unlike the previous diagnostic implementation, connection,
 * protocol and method failures are surfaced to the user instead of silently
 * falling through to the generic broadcast rejection.
 */
export async function preflightNamespaceTransaction(rawTransaction: string): Promise<void> {
  if (!/^[0-9a-f]+$/i.test(rawTransaction) || rawTransaction.length % 2 !== 0) {
    throw new Error('Invalid raw namespace transaction.');
  }

  let client: NamespacePreflightClient | undefined;
  try {
    ({ client } = await connectPreflightElectrum());
    const response = await client.request('blockchain.transaction.testmempoolaccept', [[rawTransaction]]);
    const reason = namespaceMempoolRejectReason(response);
    if (reason) throw new NamespaceMempoolRejectedError(reason);

    const result = mempoolAcceptRecord(response);
    if (!result || result.allowed !== true) {
      throw new NamespacePreflightUnavailableError('ElectrumX returned no mempool acceptance result.');
    }
  } catch (error) {
    if (error instanceof NamespaceMempoolRejectedError || error instanceof NamespacePreflightUnavailableError) throw error;
    throw new NamespacePreflightUnavailableError(formatNamespaceError(error));
  } finally {
    try {
      client?.close();
    } catch {}
  }
}
