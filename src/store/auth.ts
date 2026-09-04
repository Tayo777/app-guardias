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
  /** Secreto HMAC del evento en curso, para validar los QR sin conexion. */
  qrSecret: string | null;
  /** false hasta que termina de leerse la sesion guardada en el dispositivo. */
  hidratado: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => void;
};

const SESION_VACIA = {
  token: null,
  email: null,
  eventoId: null,
  eventoNombre: null,
  miNumeroDeFila: null,
  qrSecret: null,
};

export const useAuthStore = create<EstadoAuth>()(
  persist(
    (set) => ({
      ...SESION_VACIA,
      hidratado: false,

      iniciarSesion: async (email, password) => {
        const respuesta = await api.login(email, password);
        set({
          token: respuesta.token,
          email,
          eventoId: respuesta.eventoId,
          eventoNombre: respuesta.eventoNombre,
          miNumeroDeFila: respuesta.filaAsignada,
          qrSecret: respuesta.qrSecret,
        });
      },

      cerrarSesion: () => set(SESION_VACIA),
    }),
    {
      name: 'auth-guardia',
      storage: createJSONStorage(() => almacenamientoSeguro),
      // v1 sumo qrSecret. Una sesion vieja no lo tiene y rechazaria todos los QR,
      // asi que se descarta y el guardia vuelve a loguearse para recibirlo.
      version: 1,
      migrate: () => ({ ...SESION_VACIA }),
      partialize: (estado) => ({
        token: estado.token,
        email: estado.email,
        eventoId: estado.eventoId,
        eventoNombre: estado.eventoNombre,
        miNumeroDeFila: estado.miNumeroDeFila,
        qrSecret: estado.qrSecret,
      }),
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hidratado: true });
      },
    }
  )
);
