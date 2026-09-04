import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

import { Paleta } from '@/constants/theme';
import { useSincronizacionAutomatica } from '@/hooks/use-sincronizacion-automatica';

export default function GuardiaLayout() {
  useSincronizacionAutomatica();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Paleta.texto,
        tabBarInactiveTintColor: Paleta.textoSuave,
        tabBarStyle: {
          backgroundColor: Paleta.superficie,
          borderTopColor: Paleta.borde,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Escáner',
          tabBarIcon: ({ color, size }) => <Ionicons name="scan" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="mi-fila"
        options={{
          title: 'Mi Fila',
          tabBarIcon: ({ color, size }) => <Ionicons name="people" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}
