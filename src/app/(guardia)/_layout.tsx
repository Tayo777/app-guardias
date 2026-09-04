import { Stack } from 'expo-router';

export default function GuardiaLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="escaner" options={{ title: 'Escanear entrada' }} />
    </Stack>
  );
}
