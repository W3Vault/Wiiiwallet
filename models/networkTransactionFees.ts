import * as BlueElectrum from '../blue_modules/BlueElectrum';

export enum NetworkTransactionFeeType {
  FAST = 'Fast',
  MEDIUM = 'MEDIUM',
  SLOW = 'SLOW',
  CUSTOM = 'CUSTOM',
}

/**
 * Wiiicoin Core expresses these values per 1,000 virtual bytes:
 *
 * - DEFAULT_TRANSACTION_MINFEE = 100,000 base units/kB = 100 units/vByte
 * - DEFAULT_DISCARD_FEE = 10,000 base units/kB = 10 units/vByte
 * - DEFAULT_BLOCK_MIN_TX_FEE = 1,000 base units/kB = 1 unit/vByte
 *
 * Source: Wiiigle/wiiicoin src/wallet/wallet.h and src/policy/policy.h.
 */
export const WIIICOIN_CORE_FEE_RATES = {
  fastestFee: 100,
  mediumFee: 10,
  slowFee: 1,
} as const;

export class NetworkTransactionFee {
  static StorageKey = 'NetworkTransactionFee';

  public fastestFee: number;
  public mediumFee: number;
  public slowFee: number;

  constructor(
    fastestFee = WIIICOIN_CORE_FEE_RATES.fastestFee,
    mediumFee = WIIICOIN_CORE_FEE_RATES.mediumFee,
    slowFee = WIIICOIN_CORE_FEE_RATES.slowFee,
  ) {
    this.fastestFee = fastestFee;
    this.mediumFee = mediumFee;
    this.slowFee = slowFee;
  }
}

const normalizeFeeRate = (value: number, minimum: number): number => {
  if (!Number.isFinite(value) || value <= 0) return minimum;
  return Math.max(minimum, Math.ceil(value));
};

export default class NetworkTransactionFees {
  static async recommendedFees(): Promise<NetworkTransactionFee> {
    try {
      const isDisabled = await BlueElectrum.isDisabled();
      if (isDisabled) {
        throw new Error('Electrum is disabled. Do not attempt to fetch fees');
      }

      const response = await BlueElectrum.estimateFees();
      const fastestFee = normalizeFeeRate(response.fast, WIIICOIN_CORE_FEE_RATES.fastestFee);
      const mediumFee = Math.min(fastestFee, normalizeFeeRate(response.medium, WIIICOIN_CORE_FEE_RATES.mediumFee));
      const slowFee = Math.min(mediumFee, normalizeFeeRate(response.slow, WIIICOIN_CORE_FEE_RATES.slowFee));

      return new NetworkTransactionFee(fastestFee, mediumFee, slowFee);
    } catch (err) {
      console.warn(err);
      return new NetworkTransactionFee();
    }
  }
}
