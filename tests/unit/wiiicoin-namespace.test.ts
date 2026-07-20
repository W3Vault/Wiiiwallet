import * as bitcoin from 'bitcoinjs-lib';

import {
  deriveNamespaceId,
  getNamespaceCreationScript,
  getNamespaceDeleteScript,
  getNamespaceScriptHash,
  getNamespaceUpdateScript,
  namespaceToPayload,
  payloadToNamespace,
  WIII_NAMESPACE_FEE_RATE,
  WIII_NAMESPACE_INCLUDE_VOUT,
  WIII_NAMESPACE_SEQUENCE,
  WIII_OP_DELETE,
  WIII_OP_NAMESPACE,
  WIII_OP_PUT,
} from '../../blue_modules/wiiicoin-namespace';
import { uint8ArrayToHex } from '../../blue_modules/uint8array-extras';

const SOURCE_TXID = 'c70483b4613b18e750d0b1087ada28d713ad1e406ebc87d36f94063512c5f0dd';
const NAMESPACE_ID = 'NQTgCkBifLVXpFhtc4LVYr2aL1Pc3rymF2';
const NAMESPACE_PAYLOAD = '3531dfa323f306ee13ba63fa2ab7c51a94160dabf5';
const DEVICE_SOURCE_TXID = '5bf7201e9d2ca75dee17c38688a9183bf6016cb364b2ee655747f8391bcdc842';
const DEVICE_NAMESPACE_ID = 'NTEf4Zbft422WDxDMtNyM7PQypemYtB5Ra';
const DEVICE_NAMESPACE_PAYLOAD = '355051a7934af8ef07459f61a8af5baac641465b45';
const OWNER_ADDRESS = 'sJFRHbqe5txzZ9VP88MGD6fkmjwRoEY8hK';

describe('Wiiicoin namespace protocol', () => {
  it('uses the legacy Wiiicoin data-transaction fee floor', () => {
    expect(WIII_NAMESPACE_FEE_RATE).toBe(2_000);
  });

  it('uses the legacy final input sequence for namespace transactions', () => {
    expect(WIII_NAMESPACE_SEQUENCE).toBe(0xffffffff);
  });

  it('uses the live pre-NSFIX namespace derivation without the output index', () => {
    expect(WIII_NAMESPACE_INCLUDE_VOUT).toBe(false);
    expect(deriveNamespaceId(SOURCE_TXID, 0)).toBe(NAMESPACE_ID);
    expect(deriveNamespaceId(SOURCE_TXID, 1)).toBe(NAMESPACE_ID);
    expect(uint8ArrayToHex(namespaceToPayload(NAMESPACE_ID))).toBe(NAMESPACE_PAYLOAD);
    expect(payloadToNamespace(namespaceToPayload(NAMESPACE_ID))).toBe(NAMESPACE_ID);
  });

  it('matches the live device funding input rejected by the NSFIX-era payload', () => {
    expect(deriveNamespaceId(DEVICE_SOURCE_TXID, 0)).toBe(DEVICE_NAMESPACE_ID);
    expect(uint8ArrayToHex(namespaceToPayload(DEVICE_NAMESPACE_ID))).toBe(DEVICE_NAMESPACE_PAYLOAD);
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
