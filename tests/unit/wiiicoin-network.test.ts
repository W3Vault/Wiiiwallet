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
import { HDSegwitP2SHWallet } from '../../class/wallets/hd-segwit-p2sh-wallet';

const bip32 = BIP32Factory(ecc);
const generatorPublicKey = Buffer.from('0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798', 'hex');
const testMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

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
    expect(wrapped?.startsWith('2')).toBe(true);
    expect(native?.startsWith(`${WIIICOIN_BECH32_HRP}1`)).toBe(true);
    expect(b58.decode(legacy!)[0]).toBe(WIIICOIN_NETWORK.pubKeyHash);
    expect(b58.decode(wrapped!)[0]).toBe(WIIICOIN_NETWORK.scriptHash);
  });

  it('creates the default Wiiicoin wallet as BIP49 P2SH wrapped SegWit', () => {
    const wallet = new HDSegwitP2SHWallet();
    wallet.setSecret(testMnemonic);

    const address = wallet._getExternalAddressByIndex(0);
    expect(address.startsWith('2')).toBe(true);
    expect(b58.decode(address)[0]).toBe(WIIICOIN_NETWORK.scriptHash);
    expect(wallet.getDerivationPath()).toBe(WIIICOIN_DERIVATION_PATHS.wrappedSegwit);
  });

  it('signs a Wiiicoin BIP49 transaction using the 0x89 WIF network version', () => {
    const wallet = new HDSegwitP2SHWallet();
    wallet.setSecret(testMnemonic);

    const sourceAddress = wallet._getExternalAddressByIndex(0);
    const destinationAddress = wallet._getExternalAddressByIndex(1);
    const changeAddress = wallet._getInternalAddressByIndex(0);
    const sourceWif = wallet._getExternalWIFByIndex(0);

    expect(sourceAddress.startsWith('2')).toBe(true);
    expect(destinationAddress.startsWith('2')).toBe(true);
    expect(changeAddress.startsWith('2')).toBe(true);
    expect(sourceWif).toBeTruthy();
    expect(wif.decode(String(sourceWif)).version).toBe(WIIICOIN_NETWORK.wif);

    const result = wallet.createTransaction(
      [
        {
          txid: '00'.repeat(32),
          vout: 0,
          value: 2_000_000,
          address: sourceAddress,
          height: 1,
          confirmations: 1,
          wif: sourceWif,
        },
      ],
      [{ address: destinationAddress, value: 1_000_000 }],
      1,
      changeAddress,
      0xffffffff,
      false,
      0,
    );

    expect(result.tx).toBeDefined();
    expect(result.tx?.toHex().length).toBeGreaterThan(100);
    expect(result.outputs.every(output => !output.address || output.address.startsWith('2'))).toBe(true);
  });

  it('exports child private keys using the Wiiicoin WIF prefix', () => {
    const root = bip32.fromSeed(Buffer.alloc(32, 1), WIIICOIN_NETWORK);
    const child = root.derivePath(`${WIIICOIN_DERIVATION_PATHS.wrappedSegwit}/0/0`);
    expect(wif.decode(child.toWIF()).version).toBe(WIIICOIN_NETWORK.wif);
  });

  it('uses the Wiiicoin private coin type and Electrum endpoint', () => {
    expect(WIIICOIN_DERIVATION_PATHS.legacy).toBe("m/44'/9999'/0'");
    expect(WIIICOIN_DERIVATION_PATHS.wrappedSegwit).toBe("m/49'/9999'/0'");
    expect(WIIICOIN_DERIVATION_PATHS.nativeSegwit).toBe("m/84'/9999'/0'");
    expect(WIIICOIN_ELECTRUM_SERVER).toEqual({ host: 'etx1.wiiicoin.io', tcp: 50001 });
  });
});
