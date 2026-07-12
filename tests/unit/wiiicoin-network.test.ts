import BIP32Factory from 'bip32';
import * as bitcoin from 'bitcoinjs-lib';
import b58 from 'bs58check';
import wif from 'wif';

import ecc from '../../blue_modules/noble_ecc';
import {
  WIIICOIN_BECH32_HRP,
  WIIICOIN_DERIVATION_PATHS,
  WIIICOIN_ELECTRUM_SERVER,
  WIIICOIN_NETWORK,
} from '../../blue_modules/wiiicoin-network';

const bip32 = BIP32Factory(ecc);
const generatorPublicKey = Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex');

describe('Wiiicoin network configuration', () => {
  it('installs Wiiicoin as the application-wide bitcoinjs network', () => {
    expect(bitcoin.networks.bitcoin).toMatchObject(WIIICOIN_NETWORK);
  });

  it('creates Wiiicoin legacy and SegWit addresses', () => {
    const legacy = bitcoin.payments.p2pkh({ pubkey: generatorPublicKey, network: WIIICOIN_NETWORK }).address;
    const wrapped = bitcoin.payments.p2sh({
      redeem: bitcoin.payments.p2wpkh({ pubkey: generatorPublicKey, network: WIIICOIN_NETWORK }),
      network: WIIICOIN_NETWORK,
    }).address;
    const native = bitcoin.payments.p2wpkh({ pubkey: generatorPublicKey, network: WIIICOIN_NETWORK }).address;

    expect(legacy).toBeDefined();
    expect(wrapped).toBeDefined();
    expect(native?.startsWith(`${WIIICOIN_BECH32_HRP}1`)).toBe(true);
    expect(b58.decode(legacy!)[0]).toBe(WIIICOIN_NETWORK.pubKeyHash);
    expect(b58.decode(wrapped!)[0]).toBe(WIIICOIN_NETWORK.scriptHash);
  });

  it('exports child private keys using the Wiiicoin WIF prefix', () => {
    const root = bip32.fromSeed(Buffer.alloc(32, 1), WIIICOIN_NETWORK);
    const child = root.derivePath(`${WIIICOIN_DERIVATION_PATHS.nativeSegwit}/0/0`);
    expect(wif.decode(child.toWIF()).version).toBe(WIIICOIN_NETWORK.wif);
  });

  it('uses the Wiiicoin private coin type and Electrum endpoint', () => {
    expect(WIIICOIN_DERIVATION_PATHS.legacy).toBe("m/44'/9999'/0'");
    expect(WIIICOIN_DERIVATION_PATHS.wrappedSegwit).toBe("m/49'/9999'/0'");
    expect(WIIICOIN_DERIVATION_PATHS.nativeSegwit).toBe("m/84'/9999'/0'");
    expect(WIIICOIN_ELECTRUM_SERVER).toEqual({ host: 'wiiicoin.io', ssl: 50002 });
  });
});
