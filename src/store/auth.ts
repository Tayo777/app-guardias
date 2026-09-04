import * as SecureStore from 'expo-secure-store';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import * as api from '@/lib/api';

const almacenamientoSeguro = {
  getItem: (nombre: string) => SecureStore.getItemAsync(nombre),
  setItem: (nombre: string, valor: string) => SecureStore.setItemAsync(nombre, valor),
  removeItem: (nombre: string) => SecureStore.deleteItemAsync(nombre),
};

type EstadoAuth = {
  token: string | null;
  email: string | null;
  eventoId: number | null;
  eventoNombre: string | null;
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
      email: null,
      eventoId: null,
      eventoNombre: null,
      miNumeroDeFila: null,
      hidratado: false,

      iniciarSesion: async (email, password) => {
        const respuesta = await api.login(email, password);
        set({
          token: respuesta.token,
          email,
          eventoId: respuesta.eventoId,
          eventoNombre: respuesta.eventoNombre,
          miNumeroDeFila: respuesta.filaAsignada,
        });
      },

      cerrarSesion: () => {
        set({
          token: null,
          email: null,
          eventoId: null,
          eventoNombre: null,
          miNumeroDeFila: null,
        });
      },
    }),
    {
      name: 'auth-guardia',
      storage: createJSONStorage(() => almacenamientoSeguro),
      partialize: (estado) => ({
        token: estado.token,
        email: estado.email,
        eventoId: estado.eventoId,
        eventoNombre: estado.eventoNombre,
        miNumeroDeFila: estado.miNumeroDeFila,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hidratado: true });
      },
    }
  )
);
