import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import * as SplashScreen from 'expo-splash-screen';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { DATABASE_NAME } from '@/lib/config';
import { migrarBaseDeDatos } from '@/lib/db';
import { SesionProvider, useSesion } from '@/lib/session';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={migrarBaseDeDatos}>
        <SesionProvider>
          <NavegadorRaiz />
        </SesionProvider>
      </SQLiteProvider>
    </ThemeProvider>
  );
}

function NavegadorRaiz() {
  const { sesion, cargando } = useSesion();

  if (cargando) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!!sesion}>
        <Stack.Screen name="(guardia)" />
      </Stack.Protected>

      <Stack.Protected guard={!sesion}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
