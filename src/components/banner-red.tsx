import { useNetworkState } from 'expo-network';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Paleta, Spacing } from '@/constants/theme';

/**
 * Banner global de conectividad. Vive arriba del navegador, asi que absorbe el
 * inset superior: las pantallas de abajo no deben volver a aplicarlo.
 */
export function BannerRed() {
  const insets = useSafeAreaInsets();
  const { isConnected, isInternetReachable } = useNetworkState();

  // isInternetReachable llega undefined mientras se determina: solo lo tomamos
  // como offline cuando el sistema confirma que no hay salida a internet.
  const enLinea = isConnected === true && isInternetReachable !== false;

  return (
    <View
      style={[
        styles.contenedor,
        {
          paddingTop: insets.top + Spacing.one,
          backgroundColor: enLinea ? Paleta.superficie : '#450a0a',
        },
      ]}>
      <View style={[styles.punto, { backgroundColor: enLinea ? Paleta.exito : Paleta.error }]} />
      <Text style={[styles.texto, { color: enLinea ? Paleta.textoSuave : '#fca5a5' }]}>
        {enLinea ? 'Online' : 'Offline - Modo Seguro Local'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingBottom: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  punto: { width: 8, height: 8, borderRadius: 4 },
  texto: { fontSize: 12, fontWeight: '600' },
});
