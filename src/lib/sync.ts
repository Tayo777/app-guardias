import type { SQLiteDatabase } from 'expo-sqlite';

import * as api from '@/lib/api';
import { guardarDescarga, limpiarPendientes, obtenerPendientes } from '@/lib/db';

/** Trae TODAS las entradas del evento para tener el mapa offline completo. */
export async function descargarEntradas(db: SQLiteDatabase, token: string) {
  const tickets = await api.syncDownload(token);
  await guardarDescarga(db, tickets);
  return tickets.length;
}

/**
 * Sube los escaneos hechos offline. Recien despues de que el backend confirma
 * se limpia el flag: si falla, quedan pendientes para el proximo intento.
 */
export async function subirEscaneos(db: SQLiteDatabase, token: string) {
  const pendientes = await obtenerPendientes(db);
  if (pendientes.length === 0) return 0;

  // El backend espera la fecha como fecha_escaneo, no como usada_at.
  await api.syncUpload(
    token,
    pendientes.map((p) => ({ id: p.id, fecha_escaneo: p.usada_at }))
  );
  await limpiarPendientes(
    db,
    pendientes.map((p) => p.id)
  );
  return pendientes.length;
}
