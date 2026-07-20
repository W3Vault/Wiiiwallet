import Clipboard from '@react-native-clipboard/clipboard';

export const copyNamespaceIdToClipboard = (namespaceId: string): void => {
  Clipboard.setString(namespaceId);
};
