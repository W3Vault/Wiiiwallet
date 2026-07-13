import { RouteProp, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, StyleSheet, Text, TextInput, useColorScheme, View } from 'react-native';
import Animated, { Layout } from 'react-native-reanimated';

import { hexToUint8Array, uint8ArrayToHex } from '../../blue_modules/uint8array-extras';
import triggerHapticFeedback, { HapticFeedbackTypes } from '../../blue_modules/hapticFeedback';
import { HDSegwitP2SHWallet } from '../../class/wallets/hd-segwit-p2sh-wallet';
import presentAlert from '../../components/Alert';
import BlueButtonLink from '../../components/BlueButtonLink';
import BlueFormLabel from '../../components/BlueFormLabel';
import { BlueSpacing20, BlueSpacing40 } from '../../components/BlueSpacing';
import Button from '../../components/Button';
import HeaderMenuButton from '../../components/HeaderMenuButton';
import SafeAreaScrollView from '../../components/SafeAreaScrollView';
import { useTheme } from '../../components/themes';
import { resetScanWasBBQR } from '../../helpers/scan-qr';
import { useStorage } from '../../hooks/context/useStorage';
import { useExtendedNavigation } from '../../hooks/useExtendedNavigation';
import loc from '../../loc';
import { AddWalletStackParamList } from '../../navigation/AddWalletStack';
import { CommonToolTipActions } from '../../typings/CommonToolTipActions';

type NavigationProps = NativeStackNavigationProp<AddWalletStackParamList, 'AddWallet'>;
type RouteProps = RouteProp<AddWalletStackParamList, 'AddWallet'>;

/**
 * Wiiiwallet supports one on-chain wallet format only:
 * BIP49 P2SH-wrapped SegWit using Wiiicoin addresses beginning with "2".
 */
const WalletsAdd: React.FC = () => {
  const { colors } = useTheme();
  const colorScheme = useColorScheme();
  const layoutTransition = useMemo(() => Layout.springify().damping(16).stiffness(180), []);
  const [isLoading, setIsLoading] = useState(true);
  const [label, setLabel] = useState('');

  const { addWallet, saveToDisk } = useStorage();
  const route = useRoute<RouteProps>();
  const { entropy: entropyHex, words } = route.params || {};
  const entropy = entropyHex ? hexToUint8Array(entropyHex) : undefined;
  const { navigate, setParams, setOptions } = useExtendedNavigation<NavigationProps>();

  const stylesHook = {
    label: {
      borderColor: colors.formBorder,
      borderBottomColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    root: {
      backgroundColor: colors.elevated,
    },
    walletType: {
      borderColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
    walletTypeTitle: {
      color: colors.foregroundColor,
    },
    walletTypeSubtitle: {
      color: colors.feeText,
    },
  };

  const entropyButtonText = useMemo(() => {
    if (!entropy) return loc.wallets.add_entropy_provide;
    return loc.formatString(loc.wallets.add_entropy_bytes, { bytes: entropy.length });
  }, [entropy]);

  const resetEntropy = useCallback(() => {
    if (!entropy && !words) return;
    Alert.alert(
      loc.wallets.add_entropy_reset_title,
      loc.wallets.add_entropy_reset_message,
      [
        { text: loc._.cancel, style: 'cancel' },
        {
          text: loc._.ok,
          style: 'destructive',
          onPress: () => setParams({ entropy: undefined, words: undefined }),
        },
      ],
      { cancelable: true },
    );
  }, [entropy, setParams, words]);

  const headerActions = useMemo(
    () => [
      {
        ...CommonToolTipActions.Entropy,
        text: entropyButtonText,
        subactions: [
          {
            id: '12_words',
            text: loc.wallets.add_wallet_seed_length_12,
            subtitle: loc.wallets.add_wallet_seed_length,
            menuState: words === 12,
          },
          {
            id: '24_words',
            text: loc.wallets.add_wallet_seed_length_24,
            subtitle: loc.wallets.add_wallet_seed_length,
            menuState: words === 24,
          },
          { ...CommonToolTipActions.ResetToDefault, hidden: !entropy },
        ],
      },
    ],
    [entropy, entropyButtonText, words],
  );

  const HeaderRight = useMemo(
    () => (
      <HeaderMenuButton
        onPressMenuItem={(id: string) => {
          if (id === '12_words') {
            navigate('ProvideEntropy', { words: 12, entropy: entropy ? uint8ArrayToHex(entropy) : undefined });
          } else if (id === '24_words') {
            navigate('ProvideEntropy', { words: 24, entropy: entropy ? uint8ArrayToHex(entropy) : undefined });
          } else if (id === CommonToolTipActions.ResetToDefault.id) {
            resetEntropy();
          }
        }}
        actions={headerActions}
      />
    ),
    [entropy, headerActions, navigate, resetEntropy],
  );

  const renderHeaderRight = useCallback(() => HeaderRight, [HeaderRight]);

  useEffect(() => {
    const defaultStatusBarStyle: 'light' | 'dark' = colorScheme === 'dark' ? 'light' : 'dark';
    const statusBarStyle = Platform.select<'light' | 'dark'>({
      ios: 'light',
      default: defaultStatusBarStyle,
    });
    setOptions({ headerRight: renderHeaderRight, statusBarStyle });
  }, [colorScheme, renderHeaderRight, setOptions]);

  useEffect(() => {
    resetScanWasBBQR();
    setIsLoading(false);
  }, []);

  const createWallet = async () => {
    setIsLoading(true);
    try {
      const wallet = new HDSegwitP2SHWallet();
      wallet.setLabel(label || loc.wallets.details_title);

      if (entropy) {
        await wallet.generateFromEntropy(entropy);
      } else {
        await wallet.generate();
      }

      const firstAddress = wallet._getExternalAddressByIndex(0);
      if (!firstAddress.startsWith('2')) {
        throw new Error(`Unexpected Wiiicoin address format: ${firstAddress}`);
      }

      addWallet(wallet);
      await saveToDisk();
      triggerHapticFeedback(HapticFeedbackTypes.NotificationSuccess);
      navigate('PleaseBackup', { walletID: wallet.getID() });
    } catch (error: any) {
      console.warn('Wiiicoin wallet creation failed', error);
      triggerHapticFeedback(HapticFeedbackTypes.NotificationError);
      presentAlert({ title: loc.errors.error, message: error?.message || String(error) });
      setIsLoading(false);
    }
  };

  return (
    <Animated.View layout={layoutTransition} style={styles.flex1}>
      <SafeAreaScrollView
        style={stylesHook.root}
        testID="ScrollView"
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        automaticallyAdjustContentInsets
        automaticallyAdjustsScrollIndicatorInsets
      >
        <BlueSpacing20 />

        <BlueFormLabel>{loc.wallets.add_wallet_name}</BlueFormLabel>
        <View style={[styles.label, stylesHook.label]}>
          <TextInput
            testID="WalletNameInput"
            value={label}
            placeholderTextColor="#81868e"
            placeholder={loc.wallets.add_placeholder}
            onChangeText={setLabel}
            style={styles.textInputCommon}
            editable={!isLoading}
            underlineColorAndroid="transparent"
          />
        </View>

        <BlueFormLabel>{loc.wallets.add_wallet_type}</BlueFormLabel>
        <View style={[styles.walletType, stylesHook.walletType]}>
          <Text style={[styles.walletTypeTitle, stylesHook.walletTypeTitle]}>Wiiicoin SegWit</Text>
          <Text style={[styles.walletTypeSubtitle, stylesHook.walletTypeSubtitle]}>
            BIP49 P2SH-P2WPKH · addresses begin with 2
          </Text>
        </View>

        <View style={styles.actions}>
          {!isLoading ? (
            <>
              <Button testID="Create" title={loc.wallets.add_create} onPress={createWallet} />
              <BlueButtonLink
                testID="ImportWallet"
                style={styles.import}
                title={loc.wallets.add_import_wallet}
                onPress={() => navigate('ImportWallet')}
              />
              <BlueSpacing40 />
            </>
          ) : (
            <ActivityIndicator />
          )}
        </View>
      </SafeAreaScrollView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  label: {
    flexDirection: 'row',
    borderWidth: 1,
    borderBottomWidth: 0.5,
    minHeight: 44,
    height: 44,
    marginHorizontal: 20,
    alignItems: 'center',
    marginVertical: 16,
    borderRadius: 4,
  },
  textInputCommon: {
    flex: 1,
    marginHorizontal: 8,
    color: '#81868e',
    fontSize: 15,
    lineHeight: 19,
  },
  walletType: {
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: 20,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  walletTypeTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  walletTypeSubtitle: {
    fontSize: 13,
    marginTop: 5,
  },
  actions: {
    marginHorizontal: 20,
    marginTop: 16,
  },
  import: {
    marginVertical: 24,
  },
});

export default WalletsAdd;
