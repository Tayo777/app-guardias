import type { SQLiteDatabase } from 'expo-sqlite';

import * as api from '@/lib/api';
import { guardarDescarga, limpiarPendientes, obtenerPendientes } from '@/lib/db';

/** Trae TODAS las entradas del evento para tener el mapa offline completo. */
export async function descargarEntradas(db: SQLiteDatabase, token: string) {
  const tickets = await api.syncDownload(token);
  await guardarDescarga(db, tickets);
  return tickets.length;
}

/** Sube los escaneos hechos offline y recien ahi los desmarca como pendientes. */
export async function subirEscaneos(db: SQLiteDatabase, token: string) {
  const pendientes = await obtenerPendientes(db);
  if (pendientes.length === 0) return 0;

  await api.syncUpload(token, pendientes);
  await limpiarPendientes(
    db,
    pendientes.map((p) => p.codigo_qr)
  );
  return pendientes.length;
}
