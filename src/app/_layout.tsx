import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, View } from 'react-native';

import { ActualizadorApp } from '@/components/actualizador-app';
import { BannerRed } from '@/components/banner-red';
import { Paleta } from '@/constants/theme';
import { DATABASE_NAME } from '@/lib/config';
import { migrarBaseDeDatos } from '@/lib/db';
import { useAuthStore } from '@/store/auth';

export default function RootLayout() {
  return (
    <ThemeProvider value={DarkTheme}>
      <StatusBar style="light" />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrarBaseDeDatos}>
        <View style={styles.raiz}>
          <BannerRed />
          <NavegadorRaiz />
          <ActualizadorApp />
        </View>
      </SQLiteProvider>
    </ThemeProvider>
  );
}

function NavegadorRaiz() {
  const token = useAuthStore((estado) => estado.token);
  const hidratado = useAuthStore((estado) => estado.hidratado);

  // Sin esto se ve un parpadeo del login antes de leer la sesion guardada.
  if (!hidratado) return <View style={styles.raiz} />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Paleta.fondo },
      }}>
      <Stack.Protected guard={!!token}>
        <Stack.Screen name="(guardia)" />
      </Stack.Protected>

      <Stack.Protected guard={!token}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Paleta.fondo },
});
