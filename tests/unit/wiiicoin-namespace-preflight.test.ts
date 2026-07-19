import {
  NamespaceMempoolRejectedError,
  namespaceMempoolRejectReason,
} from '../../blue_modules/wiiicoin-namespace-preflight';

describe('Wiiicoin namespace mempool preflight', () => {
  it('returns the normalized ElectrumX rejection reason', () => {
    expect(
      namespaceMempoolRejectReason([
        {
          txid: '00'.repeat(32),
          wtxid: '11'.repeat(32),
          allowed: false,
          reason: 'mandatory-script-verify-flag-failed',
        },
      ]),
    ).toBe('mandatory-script-verify-flag-failed');
  });

  it('supports raw Core reject fields when returned by a compatible server', () => {
    expect(namespaceMempoolRejectReason({ allowed: false, 'reject-reason': 'bad-txns-inputs-missingorspent' })).toBe(
      'bad-txns-inputs-missingorspent',
    );
  });

  it('does not report an error for an accepted transaction', () => {
    expect(namespaceMempoolRejectReason([{ allowed: true }])).toBeUndefined();
  });

  it('creates a readable node rejection error', () => {
    expect(new NamespaceMempoolRejectedError('min relay fee not met').message).toBe(
      'Wiiicoin Core rejected the namespace transaction: min relay fee not met',
    );
  });
});
