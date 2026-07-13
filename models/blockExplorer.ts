// blockExplorer.ts
import DefaultPreference from 'react-native-default-preference';

export interface BlockExplorer {
  key: string;
  name: string;
  url: string;
}

export const BLOCK_EXPLORERS: { [key: string]: BlockExplorer } = {
  default: { key: 'default', name: 'Wiiicoin Explorer', url: 'https://wiiicoin.io' },
};

export const getBlockExplorersList = (): BlockExplorer[] => {
  return [BLOCK_EXPLORERS.default];
};

export const normalizeUrl = (url: string): string => {
  return url.replace(/\/+$/, '');
};

export const isValidUrl = (url: string): boolean => {
  const pattern = /^(https?:\/\/)/;
  return pattern.test(url);
};

export const findMatchingExplorerByDomain = (url: string): BlockExplorer | null => {
  return getDomain(url) === getDomain(BLOCK_EXPLORERS.default.url) ? BLOCK_EXPLORERS.default : null;
};

export const getDomain = (url: string): string => {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

const BLOCK_EXPLORER_STORAGE_KEY = 'blockExplorer';

export const saveBlockExplorer = async (url: string): Promise<boolean> => {
  try {
    if (getDomain(url) !== getDomain(BLOCK_EXPLORERS.default.url)) return false;
    await DefaultPreference.set(BLOCK_EXPLORER_STORAGE_KEY, BLOCK_EXPLORERS.default.url);
    return true;
  } catch (error) {
    console.error('Error saving block explorer:', error);
    return false;
  }
};

export const removeBlockExplorer = async (): Promise<boolean> => {
  try {
    await DefaultPreference.clear(BLOCK_EXPLORER_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error removing block explorer:', error);
    return false;
  }
};

export const getBlockExplorerUrl = async (): Promise<string> => {
  try {
    const storedUrl = (await DefaultPreference.get(BLOCK_EXPLORER_STORAGE_KEY)) as string | null;
    if (storedUrl && getDomain(storedUrl) === getDomain(BLOCK_EXPLORERS.default.url)) {
      return BLOCK_EXPLORERS.default.url;
    }

    // Ignore and replace any previously stored Bitcoin explorer selection.
    await DefaultPreference.set(BLOCK_EXPLORER_STORAGE_KEY, BLOCK_EXPLORERS.default.url);
    return BLOCK_EXPLORERS.default.url;
  } catch (error) {
    console.error('Error getting block explorer:', error);
    return BLOCK_EXPLORERS.default.url;
  }
};
