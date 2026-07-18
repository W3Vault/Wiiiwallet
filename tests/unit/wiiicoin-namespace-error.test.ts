import { formatNamespaceError } from '../../blue_modules/wiiicoin-namespace-error';

describe('Wiiicoin namespace errors', () => {
  it('shows a structured Electrum message and code', () => {
    expect(formatNamespaceError({ code: 1, message: 'the transaction was rejected by network rules.' })).toBe(
      'the transaction was rejected by network rules. (code 1)',
    );
  });

  it('removes a raw transaction dump from a network rejection', () => {
    const rawTransaction = '00'.repeat(274);
    expect(formatNamespaceError({ code: 1, message: `the transaction was rejected by network rules.\n\n[${rawTransaction}]` })).toBe(
      'the transaction was rejected by network rules. (code 1)',
    );
  });
});
