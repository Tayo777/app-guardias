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
 * "EVT-CE80AE28.1dd872ee9dc596d1" -> "CE80AE28". El backend podria indexar por
 * el token completo o solo por el codigo corto, asi que se mandan los dos.
 */
function codigoCorto(id: string): string | null {
  const match = id.match(/^[A-Za-z]{2,10}-([A-Za-z0-9]+)[.-]/);
  return match ? match[1] : null;
}

/**
 * Cuantos escaneos confirmo el backend. Se aceptan varias formas de respuesta
 * porque no tenemos el contrato exacto; si no informa nada reconocible se
 * devuelve null (= "no se puede saber").
 */
function confirmados(respuesta: api.RespuestaSyncUpload): number | null {
  if (typeof respuesta?.procesados === 'number') return respuesta.procesados;
  if (typeof respuesta?.actualizados === 'number') return respuesta.actualizados;
  if (Array.isArray(respuesta?.ids)) return respuesta.ids.length;
  return null;
}

export class SyncUploadError extends Error {
  constructor(
    message: string,
    readonly respuesta: unknown
  ) {
    super(message);
    this.name = 'SyncUploadError';
  }
}

/**
 * Sube los escaneos hechos offline.
 *
 * El flag pendiente_sync se limpia SOLO si el backend confirma que proceso los
 * escaneos. Antes se limpiaba siempre: si el backend no reconocia los ids, el
 * guardia veia "N escaneos subidos" mientras la web seguia sin registrar el
 * ingreso, y ademas se perdia el pendiente para reintentarlo.
 */
export async function subirEscaneos(db: SQLiteDatabase, token: string) {
  const pendientes = await obtenerPendientes(db);
  if (pendientes.length === 0) return 0;

  const respuesta = await api.syncUpload(
    token,
    pendientes.map((p) => ({
      id: p.id,
      codigo: p.id,
      codigo_corto: codigoCorto(p.id),
      // ISO 8601 en UTC (termina en "Z"): sin zona explicita el backend
      // interpreta la hora con la suya y quedan desfasadas.
      fecha_escaneo: p.usada_at,
    }))
  );

  const procesados = confirmados(respuesta);

  if (procesados === 0) {
    throw new SyncUploadError(
      `El servidor recibió ${pendientes.length} escaneos pero confirmó 0. ` +
        `Probablemente no reconoce el formato del id. Respuesta: ${JSON.stringify(respuesta)}`,
      respuesta
    );
  }

  await limpiarPendientes(
    db,
    pendientes.map((p) => p.id)
  );

  return procesados ?? pendientes.length;
}

/**
 * Sube lo pendiente y vuelve a bajar el estado del servidor, para que la base
 * local refleje lo que quedo realmente registrado del lado remoto.
 */
export async function sincronizarTodo(db: SQLiteDatabase, token: string) {
  const subidos = await subirEscaneos(db, token);
  const descargados = await descargarEntradas(db, token);
  return { subidos, descargados };
}
