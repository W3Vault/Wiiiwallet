import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, View } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import BlueFormLabel from '../../components/BlueFormLabel';
import BlueFormMultiInput from '../../components/BlueFormMultiInput';
import { createWiiicoinWalletFromMnemonic } from '../../class/wiiicoin-wallet-restore';
import { HDSegwitP2SHWallet } from '../../class/wallets/hd-segwit-p2sh-wallet';
import { WatchOnlyWallet } from '../../class/wallets/watch-only-wallet';
import presentAlert from '../../components/Alert';
import Button from '../../components/Button';
import SafeArea from '../../components/SafeArea';
import { useTheme } from '../../components/themes';
import { useStorage } from '../../hooks/context/useStorage';
import { AddWalletStackParamList } from '../../navigation/AddWalletStack';
import { BlueSpacing20 } from '../../components/BlueSpacing';

type NavigationProp = NativeStackNavigationProp<AddWalletStackParamList, 'ImportSpeed'>;

const ImportSpeed = () => {
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();
  const [loading, setLoading] = useState<boolean>(false);
  const [importText, setImportText] = useState<string>('');
  const [walletType, setWalletType] = useState<string>(HDSegwitP2SHWallet.type);
  const [passphrase, setPassphrase] = useState<string>('');
  const { addAndSaveWallet } = useStorage();

  const styles = StyleSheet.create({
    root: {
      paddingTop: 40,
      backgroundColor: colors.elevated,
    },
    center: {
      flex: 1,
      marginHorizontal: 16,
      backgroundColor: colors.elevated,
    },
    pathInput: {
      flexDirection: 'row',
      borderWidth: 1,
      borderBottomWidth: 0.5,
      minHeight: 44,
      height: 44,
      alignItems: 'center',
      marginVertical: 8,
      borderRadius: 4,
      paddingHorizontal: 8,
      color: '#81868e',
      borderColor: colors.formBorder,
      borderBottomColor: colors.formBorder,
      backgroundColor: colors.inputBackgroundColor,
    },
  });

  const importMnemonic = async () => {
    setLoading(true);
    try {
      let wallet;
      if (!walletType || walletType === HDSegwitP2SHWallet.type) {
        wallet = createWiiicoinWalletFromMnemonic(importText, passphrase || undefined);
      } else if (walletType === WatchOnlyWallet.type) {
        wallet = new WatchOnlyWallet();
        wallet.setSecret(importText);
        wallet.init();
      } else {
        throw new Error('Invalid wallet type');
      }

      await wallet.fetchBalance();
      navigation.getParent()?.goBack();
      addAndSaveWallet(wallet);
    } catch (e: any) {
      presentAlert({ message: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeArea style={styles.root}>
      <BlueSpacing20 />
      <BlueFormLabel>Mnemonic</BlueFormLabel>
      <BlueSpacing20 />
      <BlueFormMultiInput testID="SpeedMnemonicInput" value={importText} onChangeText={setImportText} />
      <BlueFormLabel>Wallet type</BlueFormLabel>
      <TextInput testID="SpeedWalletTypeInput" value={walletType} style={styles.pathInput} onChangeText={setWalletType} />
      <BlueFormLabel>Passphrase</BlueFormLabel>
      <TextInput testID="SpeedPassphraseInput" value={passphrase} style={styles.pathInput} onChangeText={setPassphrase} />
      <BlueSpacing20 />
      <View style={styles.center}>
        {loading ? <ActivityIndicator /> : <Button testID="SpeedDoImport" title="Import" onPress={importMnemonic} />}
      </View>
    </SafeArea>
  );
};

export default ImportSpeed;
