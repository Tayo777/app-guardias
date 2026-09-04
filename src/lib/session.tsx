import * as SecureStore from 'expo-secure-store';
import { createContext, use, useCallback, useEffect, useState, type PropsWithChildren } from 'react';

import * as api from '@/lib/api';
import type { Sesion } from '@/lib/types';

const CLAVE_SESION = 'sesion_guardia';

type ContextoSesion = {
  sesion: Sesion | null;
  cargando: boolean;
  iniciarSesion: (email: string, password: string) => Promise<void>;
  cerrarSesion: () => Promise<void>;
};

const SesionContext = createContext<ContextoSesion | null>(null);

export function useSesion() {
  const valor = use(SesionContext);
  if (!valor) throw new Error('useSesion debe usarse dentro de <SesionProvider />');
  return valor;
}

export function SesionProvider({ children }: PropsWithChildren) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(CLAVE_SESION)
      .then((guardado) => {
        if (guardado) setSesion(JSON.parse(guardado) as Sesion);
      })
      .finally(() => setCargando(false));
  }, []);

  const iniciarSesion = useCallback(async (email: string, password: string) => {
    const { token, guardia } = await api.login(email, password);
    const nueva: Sesion = { token, guardia };
    await SecureStore.setItemAsync(CLAVE_SESION, JSON.stringify(nueva));
    setSesion(nueva);
  }, []);

  const cerrarSesion = useCallback(async () => {
    await SecureStore.deleteItemAsync(CLAVE_SESION);
    setSesion(null);
  }, []);

  return (
    <SesionContext value={{ sesion, cargando, iniciarSesion, cerrarSesion }}>
      {children}
    </SesionContext>
  );
}
