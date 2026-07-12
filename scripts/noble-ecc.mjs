import * as necc from '@noble/secp256k1';
import { hmac } from '@noble/hashes/hmac';
import { sha256 } from '@noble/hashes/sha2';

necc.hashes.sha256 = sha256;
necc.hashes.hmacSha256 = (key, message) => hmac(sha256, key, message);

const { mod, secretKeyToScalar, numberToBytesBE, bytesToNumberBE, hexToBytes } = necc.etc;
const CURVE_N = necc.Point.CURVE().n;

function pointFromBytes(point) {
  if (point.length === 32) {
    const prefixed = new Uint8Array(33);
    prefixed[0] = 0x02;
    prefixed.set(point, 1);
    return necc.Point.fromBytes(prefixed);
  }
  return necc.Point.fromBytes(point);
}

function privateAdd(privateKey, tweak) {
  const p = secretKeyToScalar(typeof privateKey === 'string' ? hexToBytes(privateKey) : privateKey);
  const t = secretKeyToScalar(typeof tweak === 'string' ? hexToBytes(tweak) : tweak);
  return numberToBytesBE(mod(p + t, CURVE_N));
}

function privateNegate(privateKey) {
  const p = secretKeyToScalar(typeof privateKey === 'string' ? hexToBytes(privateKey) : privateKey);
  return numberToBytesBE(CURVE_N - p);
}

function pointAddScalar(point, tweak, compressed = true) {
  const P = typeof point === 'string' ? necc.Point.fromHex(point) : pointFromBytes(point);
  const t = secretKeyToScalar(typeof tweak === 'string' ? hexToBytes(tweak) : tweak);
  const Q = P.add(necc.Point.BASE.multiply(t));
  if (Q.is0()) throw new Error('Tweaked point at infinity');
  return Q.toBytes(compressed);
}

function pointMultiply(point, tweak, compressed = true) {
  const P = typeof point === 'string' ? necc.Point.fromHex(point) : pointFromBytes(point);
  const tweakBytes = typeof tweak === 'string' ? hexToBytes(tweak) : tweak;
  const t = mod(bytesToNumberBE(tweakBytes), CURVE_N);
  if (t === 0n) throw new Error('Point at infinity');
  return P.multiply(t).toBytes(compressed);
}

function compactToDER(signature) {
  const encodeInt = bytes => {
    let index = 0;
    while (index < bytes.length - 1 && bytes[index] === 0) index++;
    let trimmed = bytes.subarray(index);
    if (trimmed[0] >= 0x80) {
      const prefixed = new Uint8Array(trimmed.length + 1);
      prefixed[0] = 0;
      prefixed.set(trimmed, 1);
      trimmed = prefixed;
    }
    const encoded = new Uint8Array(2 + trimmed.length);
    encoded[0] = 0x02;
    encoded[1] = trimmed.length;
    encoded.set(trimmed, 2);
    return encoded;
  };

  const rDer = encodeInt(signature.subarray(0, 32));
  const sDer = encodeInt(signature.subarray(32, 64));
  const sequenceLength = rDer.length + sDer.length;
  const der = new Uint8Array(2 + sequenceLength);
  der[0] = 0x30;
  der[1] = sequenceLength;
  der.set(rDer, 2);
  der.set(sDer, 2 + rDer.length);
  return der;
}

function throwToNull(fn) {
  try {
    return fn();
  } catch {
    return null;
  }
}

function isPoint(point, xOnly) {
  if ((point.length === 32) !== xOnly) return false;
  try {
    pointFromBytes(point);
    return true;
  } catch {
    return false;
  }
}

const ecc = {
  isPoint: point => isPoint(point, false),
  isPrivate: privateKey => necc.utils.isValidSecretKey(privateKey),
  isXOnlyPoint: point => isPoint(point, true),

  xOnlyPointAddTweak: (point, tweak) =>
    throwToNull(() => {
      const tweaked = pointAddScalar(point, tweak, true);
      return { parity: tweaked[0] % 2 === 1 ? 1 : 0, xOnlyPubkey: tweaked.slice(1) };
    }),

  pointFromScalar: (privateKey, compressed = true) => throwToNull(() => necc.getPublicKey(privateKey, compressed)),
  pointCompress: (point, compressed = true) => pointFromBytes(point).toBytes(compressed),
  pointMultiply: (point, tweak, compressed = true) => throwToNull(() => pointMultiply(point, tweak, compressed)),
  pointAdd: (pointA, pointB, compressed = true) =>
    throwToNull(() => pointFromBytes(pointA).add(pointFromBytes(pointB)).toBytes(compressed)),
  pointAddScalar: (point, tweak, compressed = true) => throwToNull(() => pointAddScalar(point, tweak, compressed)),
  privateAdd: (privateKey, tweak) =>
    throwToNull(() => {
      const result = privateAdd(privateKey, tweak);
      return result.every(byte => byte === 0) ? null : result;
    }),
  privateNegate,
  sign: (hash, privateKey, extraEntropy) => necc.sign(hash, privateKey, { prehash: false, extraEntropy }),
  signDER: (hash, privateKey, extraEntropy) => compactToDER(necc.sign(hash, privateKey, { prehash: false, extraEntropy })),
  signSchnorr: (hash, privateKey, extraEntropy = new Uint8Array(32)) => necc.schnorr.sign(hash, privateKey, extraEntropy),
  verify: (hash, publicKey, signature, strict) => necc.verify(signature, hash, publicKey, { prehash: false, lowS: strict !== false }),
  verifySchnorr: (hash, publicKey, signature) => necc.schnorr.verify(signature, hash, publicKey),
};

export default ecc;
