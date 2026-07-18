const coinSelectAccumulative = require('coinselect/accumulative');

describe('Wiiicoin namespace fee sizing', () => {
  it('includes the complete custom-output size at 2,000 satoshis per vbyte', () => {
    const result = coinSelectAccumulative(
      [
        {
          txid: '00'.repeat(32),
          vout: 0,
          value: 2_000_000,
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
    expect(result.fee).toBe(388_000);
    expect(result.fee).toBeGreaterThanOrEqual(386_000);
  });
});
