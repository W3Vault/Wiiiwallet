import * as bitcoin from 'bitcoinjs-lib';

import {
  deriveNamespaceId,
  getNamespaceCreationScript,
  getNamespaceDeleteScript,
  getNamespaceScriptHash,
  getNamespaceUpdateScript,
  namespaceToPayload,
  payloadToNamespace,
  WIII_OP_DELETE,
  WIII_OP_NAMESPACE,
  WIII_OP_PUT,
} from '../../blue_modules/wiiicoin-namespace';
import { uint8ArrayToHex } from '../../blue_modules/uint8array-extras';

const SOURCE_TXID = 'c70483b4613b18e750d0b1087ada28d713ad1e406ebc87d36f94063512c5f0dd';
const NAMESPACE_ID = 'NaCaQWV7fnZDRFKVBhkhUvysEG1UKJvd1P';
const NAMESPACE_PAYLOAD = '359cb5d1022c53411522ebe7f5b179772d0f1f54fd';
const OWNER_ADDRESS = 'sJFRHbqe5txzZ9VP88MGD6fkmjwRoEY8hK';

describe('Wiiicoin namespace protocol', () => {
  it('derives the legacy-compatible namespace identifier from the first input', () => {
    expect(deriveNamespaceId(SOURCE_TXID, 0)).toBe(NAMESPACE_ID);
    expect(uint8ArrayToHex(namespaceToPayload(NAMESPACE_ID))).toBe(NAMESPACE_PAYLOAD);
    expect(payloadToNamespace(namespaceToPayload(NAMESPACE_ID))).toBe(NAMESPACE_ID);
  });

  it('builds a namespace creation script', () => {
    const script = getNamespaceCreationScript('Example namespace', OWNER_ADDRESS, SOURCE_TXID, 0);
    const chunks = bitcoin.script.decompile(script);

    expect(chunks?.[0]).toBe(WIII_OP_NAMESPACE);
    expect(uint8ArrayToHex(chunks?.[1] as Uint8Array)).toBe(NAMESPACE_PAYLOAD);
    expect(Buffer.from(chunks?.[2] as Uint8Array).toString('utf8')).toBe('Example namespace');
    expect(chunks?.slice(-3)).toEqual([bitcoin.opcodes.OP_HASH160, expect.any(Uint8Array), bitcoin.opcodes.OP_EQUAL]);
  });

  it('builds update and delete scripts for the same namespace', () => {
    const updateChunks = bitcoin.script.decompile(getNamespaceUpdateScript(NAMESPACE_ID, OWNER_ADDRESS, 'invoice-1', 'approved'));
    const deleteChunks = bitcoin.script.decompile(getNamespaceDeleteScript(NAMESPACE_ID, OWNER_ADDRESS, 'invoice-1'));

    expect(updateChunks?.[0]).toBe(WIII_OP_PUT);
    expect(uint8ArrayToHex(updateChunks?.[1] as Uint8Array)).toBe(NAMESPACE_PAYLOAD);
    expect(Buffer.from(updateChunks?.[2] as Uint8Array).toString('utf8')).toBe('invoice-1');
    expect(Buffer.from(updateChunks?.[3] as Uint8Array).toString('utf8')).toBe('approved');

    expect(deleteChunks?.[0]).toBe(WIII_OP_DELETE);
    expect(uint8ArrayToHex(deleteChunks?.[1] as Uint8Array)).toBe(NAMESPACE_PAYLOAD);
    expect(Buffer.from(deleteChunks?.[2] as Uint8Array).toString('utf8')).toBe('invoice-1');
  });

  it('produces a deterministic Electrum namespace script hash', () => {
    const scriptHash = getNamespaceScriptHash(NAMESPACE_ID);
    expect(scriptHash).toMatch(/^[0-9a-f]{64}$/);
    expect(getNamespaceScriptHash(NAMESPACE_ID)).toBe(scriptHash);
  });

  it('rejects malformed identifiers and values over the chain limit', () => {
    expect(() => namespaceToPayload('not-a-namespace')).toThrow('Invalid Wiiicoin namespace ID');
    expect(() => getNamespaceUpdateScript(NAMESPACE_ID, OWNER_ADDRESS, 'large', 'x'.repeat(3073))).toThrow('3072-byte limit');
  });
});
