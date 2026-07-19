import { formatNamespaceError } from '../../blue_modules/wiiicoin-namespace-error';

describe('Wiiicoin namespace errors', () => {
  it('shows a structured Electrum message and code', () => {
    expect(formatNamespaceError({ code: 1, message: 'the transaction was rejected by network rules.' })).toBe(
      'the transaction was rejected by network rules. (code 1)',
    );
  });

  it('shows a separate daemon rejection detail supplied in error data', () => {
    expect(
      formatNamespaceError({
        code: 1,
        message: 'the transaction was rejected by network rules.',
        data: { reason: 'mandatory-script-verify-flag-failed' },
      }),
    ).toBe('the transaction was rejected by network rules.\nmandatory-script-verify-flag-failed (code 1)');
  });

  it('preserves custom Electrum fields attached to an Error instance', () => {
    const error = new Error('the transaction was rejected by network rules.') as Error & {
      code: number;
      data: { reason: string };
    };
    error.code = 1;
    error.data = { reason: 'bad-txns-inputs-missingorspent' };

    expect(formatNamespaceError(error)).toBe(
      'the transaction was rejected by network rules.\nbad-txns-inputs-missingorspent (code 1)',
    );
  });

  it('removes a raw transaction dump from a network rejection', () => {
    const rawTransaction = '00'.repeat(274);
    expect(formatNamespaceError({ code: 1, message: `the transaction was rejected by network rules.\n\n[${rawTransaction}]` })).toBe(
      'the transaction was rejected by network rules. (code 1)',
    );
  });

  it('does not display a raw transaction supplied only in error data', () => {
    const rawTransaction = '00'.repeat(274);
    expect(
      formatNamespaceError({
        code: 1,
        message: 'the transaction was rejected by network rules.',
        data: rawTransaction,
      }),
    ).toBe('the transaction was rejected by network rules. (code 1)');
  });
});
