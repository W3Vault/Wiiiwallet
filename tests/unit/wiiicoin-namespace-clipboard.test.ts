import Clipboard from '@react-native-clipboard/clipboard';

import { copyNamespaceIdToClipboard } from '../../blue_modules/wiiicoin-namespace-clipboard';

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: { setString: jest.fn() },
}));

const mockSetString = Clipboard.setString as jest.MockedFunction<typeof Clipboard.setString>;

describe('Wiiicoin namespace clipboard', () => {
  beforeEach(() => {
    mockSetString.mockClear();
  });

  it('copies the complete namespace ID without truncation', () => {
    const namespaceId = 'NTEf4Zbft422WDxDMtNyM7PQypemYtB5Ra';

    copyNamespaceIdToClipboard(namespaceId);

    expect(mockSetString).toHaveBeenCalledTimes(1);
    expect(mockSetString).toHaveBeenCalledWith(namespaceId);
  });
});
