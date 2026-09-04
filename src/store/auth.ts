import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as api from '@/lib/api';
import type { Evento, Guardia } from '@/lib/types';

const almacenamientoSeguro = {
  getItem: (nombre: string) => SecureStore.getItemAsync(nombre),
  setItem: (nombre: string, valor: string) => SecureStore.setItemAsync(nombre, valor),
  removeItem: (nombre: string) => SecureStore.deleteItemAsync(nombre),
};

type EstadoAuth = {
  token: string | null;
  guardia: Guardia | null;
  evento: Evento | null;
  /** Fila que le toca cubrir a este guardia. Define que entradas son "suyas". */
  miNumeroDeFila: number | null;
  /** false hasta que termina de leerse la sesion guardada en el dispositivo. */
  hidratado: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
};

export const useAuthStore = create<EstadoAuth>()(
  persist(
    (set) => ({
      token: null,
      guardia: null,
      evento: null,
      miNumeroDeFila: null,
      hidratado: false,

      iniciarSesion: async (email, password) => {
        const { token, guardia, evento } = await api.login(email, password);
        set({
          token,
          guardia,
          evento: evento ?? null,
          miNumeroDeFila: guardia.fila_asignada,
        });
      },

      cerrarSesion: () => {
        set({ token: null, guardia: null, evento: null, miNumeroDeFila: null });
      },
    }),
    {
      name: 'auth-guardia',
      storage: createJSONStorage(() => almacenamientoSeguro),
      partialize: (estado) => ({
        token: estado.token,
        guardia: estado.guardia,
        evento: estado.evento,
        miNumeroDeFila: estado.miNumeroDeFila,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hidratado: true });
      },
    }
  )
);
