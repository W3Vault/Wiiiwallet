import React, { useCallback, useEffect, useMemo, useState } from 'react';

import * as BlueElectrum from '../../blue_modules/BlueElectrum';
import { formatNamespaceError } from '../../blue_modules/wiiicoin-namespace-error';
import { preflightNamespaceTransaction } from '../../blue_modules/wiiicoin-namespace-preflight';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import {
  createNamespace,
  fetchWalletNamespaces,
  isNamespaceCapableWallet,
  NamespaceRpcUnavailableError,
  type NamespaceSummary,
} from '../../blue_modules/wiiicoin-namespace';
import presentAlert from '../../components/Alert';
import { SettingsListItem, SettingsScrollView, SettingsSection, SettingsSectionHeader, SettingsSubtitle } from '../../components/platform';
import { useBiometrics, unlockWithBiometrics } from '../../hooks/useBiometrics';
import { useStorage } from '../../hooks/context/useStorage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import prompt from '../../helpers/prompt';
import loc from '../../loc';
import namespaceStrings from '../../loc/wiiicoinNamespace';

const itemPosition = (index: number, total: number): 'single' | 'first' | 'middle' | 'last' => {
  if (total === 1) return 'single';
  if (index === 0) return 'first';
  if (index === total - 1) return 'last';
  return 'middle';
};

const confirmTransaction = (message: string): Promise<boolean> =>
  new Promise(resolve => {
    presentAlert({
      title: namespaceStrings.confirmTitle,
      message,
      buttons: [
        { text: loc._.cancel, style: 'cancel', onPress: () => resolve(false) },
        { text: loc._.ok, style: 'default', onPress: () => resolve(true) },
      ],
      options: { cancelable: false },
    });
  });

const namespaceErrorMessage = (error: unknown): string => {
  if (error instanceof NamespaceRpcUnavailableError) return namespaceStrings.rpcUnavailable;
  return formatNamespaceError(error);
};

const NamespaceManager: React.FC = () => {
  const navigation = useExtendedNavigation();
  const { wallets, saveToDisk } = useStorage();
  const { isBiometricUseCapableAndEnabled } = useBiometrics();
  const namespaceWallets = useMemo(() => wallets.filter(isNamespaceCapableWallet), [wallets]);
  const [walletID, setWalletID] = useState<string | undefined>(namespaceWallets[0]?.getID());
  const [namespaces, setNamespaces] = useState<NamespaceSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const selectedWallet = useMemo(
    () => namespaceWallets.find(wallet => wallet.getID() === walletID) ?? namespaceWallets[0],
    [namespaceWallets, walletID],
  );

  useEffect(() => {
    if (!selectedWallet) {
      setWalletID(undefined);
      setNamespaces([]);
      return;
    }
    if (walletID !== selectedWallet.getID()) setWalletID(selectedWallet.getID());
  }, [selectedWallet, walletID]);

  const refreshNamespaces = useCallback(async () => {
    if (!selectedWallet) return;
    setIsLoading(true);
    try {
      const result = await fetchWalletNamespaces(selectedWallet);
      setNamespaces(result);
      await saveToDisk();
    } catch (error) {
      setNamespaces([]);
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({ title: namespaceStrings.errorTitle, message: namespaceErrorMessage(error) });
    } finally {
      setIsLoading(false);
    }
  }, [saveToDisk, selectedWallet]);

  useEffect(() => {
    refreshNamespaces().catch(() => {});
  }, [refreshNamespaces]);

  const createNewNamespace = useCallback(async () => {
    if (!selectedWallet || isCreating) return;
    let displayName: string;
    try {
      displayName = (await prompt(namespaceStrings.createTitle, namespaceStrings.createPrompt, { type: 'plain-text' })).trim();
    } catch {
      return;
    }
    if (!displayName) return;

    setIsCreating(true);
    try {
      const transaction = await createNamespace(selectedWallet, displayName);
      const confirmed = await confirmTransaction(namespaceStrings.confirmFee(transaction.fee));
      if (!confirmed) return;

      if (await isBiometricUseCapableAndEnabled()) {
        const authenticated = await unlockWithBiometrics();
        if (!authenticated) return;
      }

      await preflightNamespaceTransaction(transaction.tx);
      if (!(await BlueElectrum.ensureConnected())) throw new Error(namespaceStrings.networkError);
      await BlueElectrum.broadcastV2(transaction.tx);
      if (transaction.controlTxid && transaction.controlVout !== undefined) {
        selectedWallet.setUTXOMetadata(transaction.controlTxid, transaction.controlVout, { frozen: true });
      }
      await saveToDisk();
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
      presentAlert({ title: namespaceStrings.successTitle, message: namespaceStrings.createSuccess(transaction.namespaceId) });
      await refreshNamespaces();
    } catch (error) {
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({ title: namespaceStrings.errorTitle, message: namespaceErrorMessage(error) });
    } finally {
      setIsCreating(false);
    }
  }, [isBiometricUseCapableAndEnabled, isCreating, refreshNamespaces, saveToDisk, selectedWallet]);

  const openNamespace = useCallback(
    (namespace: NamespaceSummary) => {
      if (!selectedWallet) return;
      navigation.navigate('NamespaceDetails', {
        walletID: selectedWallet.getID(),
        namespaceId: namespace.namespaceId,
        displayName: namespace.displayName,
        ownerAddress: namespace.ownerAddress,
      });
    },
    [navigation, selectedWallet],
  );

  if (namespaceWallets.length === 0) {
    return (
      <SettingsScrollView>
        <SettingsSectionHeader title={namespaceStrings.walletSection} />
        <SettingsSection horizontalInset={false}>
          <SettingsListItem title={namespaceStrings.title} subtitle={namespaceStrings.noWallets} disabled position="single" />
        </SettingsSection>
      </SettingsScrollView>
    );
  }

  return (
    <SettingsScrollView>
      <SettingsSectionHeader title={namespaceStrings.walletSection} />
      <SettingsSection horizontalInset={false}>
        {namespaceWallets.map((wallet, index) => (
          <SettingsListItem
            key={wallet.getID()}
            title={wallet.getLabel()}
            subtitle={wallet.typeReadable}
            checkmark={wallet.getID() === selectedWallet?.getID()}
            onPress={() => setWalletID(wallet.getID())}
            position={itemPosition(index, namespaceWallets.length)}
          />
        ))}
      </SettingsSection>

      <SettingsSectionHeader title={namespaceStrings.actionsSection} />
      <SettingsSection horizontalInset={false}>
        <SettingsListItem
          title={namespaceStrings.create}
          iconName="key"
          onPress={createNewNamespace}
          isLoading={isCreating}
          disabled={isCreating || isLoading}
          position="first"
        />
        <SettingsListItem
          title={namespaceStrings.refresh}
          iconName="search"
          onPress={refreshNamespaces}
          isLoading={isLoading}
          disabled={isLoading || isCreating}
          position="last"
        />
      </SettingsSection>

      <SettingsSectionHeader title={namespaceStrings.namespacesSection} />
      {isLoading && namespaces.length === 0 ? (
        <SettingsSection horizontalInset={false}>
          <SettingsListItem title={namespaceStrings.loading} isLoading disabled position="single" />
        </SettingsSection>
      ) : namespaces.length === 0 ? (
        <SettingsSubtitle>{namespaceStrings.empty}</SettingsSubtitle>
      ) : (
        <SettingsSection horizontalInset={false}>
          {namespaces.map((namespace, index) => (
            <SettingsListItem
              key={namespace.namespaceId}
              title={namespace.displayName || namespace.namespaceId}
              subtitle={namespace.namespaceId}
              rightTitle={namespace.height ? String(namespace.height) : namespaceStrings.unconfirmed}
              chevron
              onPress={() => openNamespace(namespace)}
              position={itemPosition(index, namespaces.length)}
            />
          ))}
        </SettingsSection>
      )}
    </SettingsScrollView>
  );
};

export default NamespaceManager;
