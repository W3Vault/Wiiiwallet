const coinSelectAccumulative = require('coinselect/accumulative');

describe('Wiiicoin namespace fee sizing', () => {
  it('matches the original wallet conservative funding-input estimate', () => {
    const result = coinSelectAccumulative(
      [
        {
          txid: '00'.repeat(32),
          vout: 0,
          value: 2_000_000,
          // Wiiiwallet's namespace marker; the installed coinselect patch restores
          // the original wallet's 148-byte funding-input estimate.
          script: { length: 50 },
        },
      ],
      [
        {
          value: 1_000_000,
          // The namespace selector supplies the custom script estimate in this form.
          script: { length: 46 },
        },
      ],
      2_000,
    );

    expect(result.inputs).toHaveLength(1);
    expect(result.outputs).toHaveLength(2);
    expect(result.fee).toBe(502_000);
  });
});
