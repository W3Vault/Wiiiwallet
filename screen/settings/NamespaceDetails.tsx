import { useRoute, type RouteProp } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import { copyNamespaceIdToClipboard } from '../../blue_modules/wiiicoin-namespace-clipboard';
import { formatNamespaceError } from '../../blue_modules/wiiicoin-namespace-error';
import { preflightNamespaceTransaction } from '../../blue_modules/wiiicoin-namespace-preflight';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import {
  deleteNamespaceKey,
  fetchNamespaceKeyValues,
  isNamespaceCapableWallet,
  NamespaceRpcUnavailableError,
  setNamespaceKey,
  transferNamespace,
  WIII_NAMESPACE_TRANSFER_KEY_PREFIX,
  type NamespaceKeyValue,
  type NamespaceTransactionResult,
} from '../../blue_modules/wiiicoin-namespace';
import presentAlert from '../../components/Alert';
import { SettingsListItem, SettingsScrollView, SettingsSection, SettingsSectionHeader, SettingsSubtitle } from '../../components/platform';
import { useStorage } from '../../hooks/context/useStorage';
import { useBiometrics, unlockWithBiometrics } from '../../hooks/useBiometrics';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import prompt from '../../helpers/prompt';
import loc from '../../loc';
import namespaceStrings from '../../loc/wiiicoinNamespace';
import type { DetailViewStackParamList } from '../../navigation/DetailViewStackParamList';

type RouteProps = RouteProp<DetailViewStackParamList, 'NamespaceDetails'>;

const itemPosition = (index: number, total: number): 'single' | 'first' | 'middle' | 'last' => {
  if (total === 1) return 'single';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
};

const confirmAction = (message: string, destructive = false): Promise<boolean> =>
  new Promise(resolve => {
    presentAlert({
      title: namespaceStrings.confirmTitle,
      message,
      buttons: [
        { text: loc._.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: loc._.ok, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
      ],
      options: { cancelable: false },
    });
  });

const namespaceErrorMessage = (error: unknown): string => {
  if (error instanceof NamespaceRpcUnavailableError) return namespaceStrings.rpcUnavailable;
  if (error instanceof Error) return error.message;
  return formatNamespaceError(error);
};

const NamespaceDetails: React.FC = () => {
  const route = useRoute<RouteProps>();
  const navigation = useExtendedNavigation();
  const { wallets, saveToDisk } = useStorage();
  const { isBiometricUseCapableAndEnabled } = useBiometrics();
  const { walletID, namespaceId, ownerAddress } = route.params;
  const wallet = useMemo(() => wallets.find(candidate => candidate.getID() === walletID), [walletID, wallets]);
  const namespaceWallet = wallet && isNamespaceCapableWallet(wallet) ? wallet : undefined;
  const [entries, setEntries] = useState<NamespaceKeyValue[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isNamespaceIdCopied, setIsNamespaceIdCopied] = useState(false);
  const namespaceIdCopyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshEntries = useCallback(async () => {
    setIsLoading(true);
    try {
      setEntries(await fetchNamespaceKeyValues(namespaceId));
    } catch (error) {
      setEntries([]);
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({ title: namespaceStrings.errorTitle, message: namespaceErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, [namespaceId]);

  useEffect(() => {
    refreshEntries().catch(() => {});
  }, [refreshEntries]);

  useEffect(
    () => () => {
      if (namespaceIdCopyResetTimeoutRef.current) {
        clearTimeout(namespaceIdCopyResetTimeoutRef.current);
        namespaceIdCopyResetTimeoutRef.current = null;
      }
    },
    [],
  );

  const copyNamespaceId = useCallback(() => {
    if (namespaceIdCopyResetTimeoutRef.current) {
      clearTimeout(namespaceIdCopyResetTimeoutRef.current);
      namespaceIdCopyResetTimeoutRef.current = null;
    }

    copyNamespaceIdToClipboard(namespaceId);
    triggerHapticFeedback(HapticFeedbackTypes.Selection);
    setIsNamespaceIdCopied(true);
    namespaceIdCopyResetTimeoutRef.current = setTimeout(() => {
      namespaceIdCopyResetTimeoutRef.current = null;
      setIsNamespaceIdCopied(false);
    }, 1500);
  }, [namespaceId]);

  const broadcastMutation = useCallback(
    async (createTransaction: () => Promise<NamespaceTransactionResult>, successMessage: string, leaveScreen = false) => {
      if (!namespaceWallet || isSubmitting) return;
      setIsSubmitting(true);
      try {
        const transaction = await createTransaction();
        if (!(await confirmAction(namespaceStrings.confirmFee(transaction.fee)))) return;

        if (await isBiometricUseCapableAndEnabled()) {
          const authenticated = await unlockWithBiometrics();
          if (!authenticated) return;
        }

        await preflightNamespaceTransaction(transaction.tx);
        if (!(await BlueElectrum.ensureConnected())) throw new Error(namespaceStrings.networkError);
        await BlueElectrum.broadcastV2(transaction.tx);
        if (!leaveScreen && transaction.controlTxid && transaction.controlVout !== undefined) {
          namespaceWallet.setUTXOMetadata(transaction.controlTxid, transaction.controlVout, { frozen: true });
        }
        await saveToDisk();
        triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
        presentAlert({ title: namespaceStrings.successTitle, message: successMessage });
        if (leaveScreen) {
          navigation.goBack();
        } else {
          await refreshEntries();
        }
      } catch (error) {
        triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
        presentAlert({ title: namespaceStrings.errorTitle, message: namespaceErrorMessage(error) });
      } finally {
        setIsSubmitting(false);
      }
    },
    [isBiometricUseCapableAndEnabled, isSubmitting, namespaceWallet, navigation, refreshEntries, saveToDisk],
  );

  const addKeyValue = useCallback(async () => {
    if (!namespaceWallet) return;
    let key: string;
    let value: string;
    try {
      key = (await prompt(namespaceStrings.addKey, namespaceStrings.keyPrompt, { type: 'plain-text' })).trim();
      if (!key) return;
      value = await prompt(namespaceStrings.addKey, namespaceStrings.valuePrompt, { type: 'plain-text' });
    } catch {
      return;
    }
    await broadcastMutation(() => setNamespaceKey(namespaceWallet, namespaceId, key, value), namespaceStrings.broadcastSuccess);
  }, [broadcastMutation, namespaceId, namespaceWallet]);

  const updateEntry = useCallback(
    async (entry: NamespaceKeyValue) => {
      if (!namespaceWallet || entry.key.startsWith(WIII_NAMESPACE_TRANSFER_KEY_PREFIX)) return;
      let value: string;
      try {
        value = await prompt(namespaceStrings.updateKey, namespaceStrings.valuePrompt, {
          type: 'plain-text',
          defaultValue: entry.value,
        });
      } catch {
        return;
      }
      await broadcastMutation(() => setNamespaceKey(namespaceWallet, namespaceId, entry.key, value), namespaceStrings.broadcastSuccess);
    },
    [broadcastMutation, namespaceId, namespaceWallet],
  );

  const deleteKey = useCallback(async () => {
    if (!namespaceWallet) return;
    let key: string;
    try {
      key = (await prompt(namespaceStrings.deleteKey, namespaceStrings.deletePrompt, { type: 'plain-text' })).trim();
    } catch {
      return;
    }
    if (!key || !(await confirmAction(namespaceStrings.deleteConfirm(key), true))) return;
    await broadcastMutation(() => deleteNamespaceKey(namespaceWallet, namespaceId, key), namespaceStrings.broadcastSuccess);
  }, [broadcastMutation, namespaceId, namespaceWallet]);

  const transfer = useCallback(async () => {
    if (!namespaceWallet) return;
    let destination: string;
    try {
      destination = (await prompt(namespaceStrings.transfer, namespaceStrings.transferPrompt, { type: 'plain-text' })).trim();
    } catch {
      return;
    }
    if (!destination || !(await confirmAction(namespaceStrings.transferConfirm(destination), true))) return;
    await broadcastMutation(() => transferNamespace(namespaceWallet, namespaceId, destination), namespaceStrings.transferSuccess, true);
  }, [broadcastMutation, namespaceId, namespaceWallet]);

  if (!namespaceWallet) {
    return (
      <SettingsScrollView>
        <SettingsSectionHeader title={namespaceStrings.walletSection} />
        <SettingsSection horizontalInset={false}>
          <SettingsListItem title={namespaceStrings.title} subtitle={namespaceStrings.writableWalletRequired} disabled position="single" />
        </SettingsSection>
      </SettingsScrollView>
    );
  }

  return (
    <SettingsScrollView>
      <SettingsSectionHeader title={namespaceStrings.detailsTitle} />
      <SettingsSection horizontalInset={false}>
        <SettingsListItem
          title={namespaceStrings.namespaceId}
          subtitle={isNamespaceIdCopied ? loc._.copied : namespaceId}
          onPress={copyNamespaceId}
          testID="NamespaceIdCopy"
          accessibilityLabel={`${namespaceStrings.namespaceId}. ${namespaceId}`}
          accessibilityHint={namespaceStrings.copyNamespaceIdHint}
          position={ownerAddress ? 'first' : 'single'}
        />
        {ownerAddress ? <SettingsListItem title={namespaceStrings.ownerAddress} subtitle={ownerAddress} position="last" /> : null}
      </SettingsSection>

      <SettingsSectionHeader title={namespaceStrings.actionsSection} />
      <SettingsSection horizontalInset={false}>
        <SettingsListItem
          title={namespaceStrings.addKey}
          iconName="key"
          onPress={addKeyValue}
          isLoading={isSubmitting}
          disabled={isSubmitting || isLoading}
          position="first"
        />
        <SettingsListItem title={namespaceStrings.deleteKey} onPress={deleteKey} disabled={isSubmitting || isLoading} position="middle" />
        <SettingsListItem
          title={namespaceStrings.transfer}
          iconName="paperPlane"
          onPress={transfer}
          disabled={isSubmitting || isLoading}
          position="middle"
        />
        <SettingsListItem
          title={namespaceStrings.refreshEntries}
          iconName="search"
          onPress={refreshEntries}
          isLoading={isLoading}
          disabled={isLoading || isSubmitting}
          position="last"
        />
      </SettingsSection>

      <SettingsSectionHeader title={namespaceStrings.entriesSection} />
      {isLoading && entries.length === 0 ? (
        <SettingsSection horizontalInset={false}>
          <SettingsListItem title={namespaceStrings.loading} isLoading disabled position="single" />
        </SettingsSection>
      ) : entries.length === 0 ? (
        <SettingsSubtitle>{namespaceStrings.entriesEmpty}</SettingsSubtitle>
      ) : (
        <SettingsSection horizontalInset={false}>
          {entries.map((entry, index) => {
            const isTransfer = entry.key.startsWith(WIII_NAMESPACE_TRANSFER_KEY_PREFIX);
            return (
              <SettingsListItem
                key={`${entry.txid ?? entry.key}-${entry.height ?? index}`}
                title={isTransfer ? namespaceStrings.transferMarker : entry.key}
                subtitle={entry.value || undefined}
                rightTitle={entry.height ? String(entry.height) : namespaceStrings.unconfirmed}
                chevron={!isTransfer}
                disabled={isTransfer || isSubmitting}
                onPress={isTransfer ? undefined : () => updateEntry(entry)}
                position={itemPosition(index, entries.length)}
              />
            );
          })}
        </SettingsSection>
      )}
    </SettingsScrollView>
  );
};

export default NamespaceDetails;
