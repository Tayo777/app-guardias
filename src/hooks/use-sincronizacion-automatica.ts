import { useNetworkState } from 'expo-network';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useRef } from 'react';

import { contarTickets } from '@/lib/db';
import { descargarEntradas, subirEscaneos } from '@/lib/sync';
import { useAuthStore } from '@/store/auth';

/**
 * Mantiene la base local al dia sin intervencion del guardia: baja las entradas
 * la primera vez (al entrar despues del login) y sube los escaneos pendientes
 * cada vez que la red vuelve a estar Online.
 */
export function useSincronizacionAutomatica() {
  const db = useSQLiteContext();
  const token = useAuthStore((estado) => estado.token);
  const { isConnected, isInternetReachable } = useNetworkState();
  const enLinea = isConnected === true && isInternetReachable !== false;
  const enCurso = useRef(false);

  useEffect(() => {
    if (!enLinea || !token || enCurso.current) return;

    enCurso.current = true;
    (async () => {
      try {
        if ((await contarTickets(db)) === 0) {
          await descargarEntradas(db, token);
        }
        await subirEscaneos(db, token);
      } catch {
        // Backend inalcanzable: los pendientes siguen contabilizados en Mi Fila
        // y el proximo cambio de estado de red reintenta.
      } finally {
        enCurso.current = false;
      }
    })();
  }, [db, token, enLinea]);
}
