const setString = jest.fn();

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString },
}));

import { copyNamespaceIdToClipboard } from '../../blue_modules/wiiicoin-namespace-clipboard';

describe('Wiiicoin namespace clipboard', () => {
  beforeEach(() => {
    setString.mockClear();
  });

  it('copies the complete namespace ID without truncation', () => {
    const namespaceId = 'NTEf4Zbft422WDxDMtNyM7PQypemYtB5Ra';

    copyNamespaceIdToClipboard(namespaceId);

    expect(setString).toHaveBeenCalledTimes(1);
    expect(setString).toHaveBeenCalledWith(namespaceId);
  });
});
