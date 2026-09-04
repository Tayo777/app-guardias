import type { SQLiteDatabase } from 'expo-sqlite';

import type { TicketLocal, TicketRemoto } from '@/lib/types';

const VERSION_ESQUEMA = 1;

export async function migrarBaseDeDatos(db: SQLiteDatabase) {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((fila?.user_version ?? 0) >= VERSION_ESQUEMA) return;

  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY NOT NULL,
      codigo_qr TEXT NOT NULL UNIQUE,
      tipo_entrada TEXT,
      nombre_cliente TEXT,
      estado TEXT NOT NULL DEFAULT 'VALIDA',
      fila_asignada INTEGER,
      usada_at TEXT,
      usada_por_fila INTEGER,
      pendiente_sync INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_codigo_qr ON tickets (codigo_qr);
    CREATE INDEX IF NOT EXISTS idx_tickets_pendiente ON tickets (pendiente_sync);

    CREATE TABLE IF NOT EXISTS meta (
      clave TEXT PRIMARY KEY NOT NULL,
      valor TEXT
    );

    PRAGMA user_version = ${VERSION_ESQUEMA};
  `);
}

export async function guardarDescarga(db: SQLiteDatabase, tickets: TicketRemoto[]) {
  await db.withTransactionAsync(async () => {
    for (const ticket of tickets) {
      // Si el ticket tiene un escaneo local sin subir, el estado local gana:
      // todavia no llego al backend y perderlo dejaria pasar dos veces la entrada.
      await db.runAsync(
        `INSERT INTO tickets (id, codigo_qr, tipo_entrada, nombre_cliente, estado, fila_asignada)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           codigo_qr = excluded.codigo_qr,
           tipo_entrada = excluded.tipo_entrada,
           nombre_cliente = excluded.nombre_cliente,
           fila_asignada = excluded.fila_asignada,
           estado = CASE WHEN tickets.pendiente_sync = 1 THEN tickets.estado ELSE excluded.estado END`,
        [
          ticket.id,
          ticket.codigo_qr,
          ticket.tipo_entrada,
          ticket.nombre_cliente,
          ticket.estado,
          ticket.fila_asignada,
        ]
      );
    }
  });

  await db.runAsync(
    `INSERT INTO meta (clave, valor) VALUES ('ultima_descarga', ?)
     ON CONFLICT(clave) DO UPDATE SET valor = excluded.valor`,
    [new Date().toISOString()]
  );
}

export function buscarTicketPorQr(db: SQLiteDatabase, codigoQr: string) {
  return db.getFirstAsync<TicketLocal>('SELECT * FROM tickets WHERE codigo_qr = ?', [codigoQr]);
}

/** Marca la entrada como usada. Devuelve false si otro escaneo ya la habia marcado. */
export async function marcarTicketUsado(db: SQLiteDatabase, codigoQr: string, fila: number) {
  const resultado = await db.runAsync(
    `UPDATE tickets
     SET estado = 'USADA', usada_at = ?, usada_por_fila = ?, pendiente_sync = 1
     WHERE codigo_qr = ? AND estado <> 'USADA'`,
    [new Date().toISOString(), fila, codigoQr]
  );
  return resultado.changes > 0;
}

export function obtenerPendientes(db: SQLiteDatabase) {
  return db.getAllAsync<{ codigo_qr: string; usada_at: string }>(
    'SELECT codigo_qr, usada_at FROM tickets WHERE pendiente_sync = 1'
  );
}

export async function limpiarPendientes(db: SQLiteDatabase, codigosQr: string[]) {
  if (codigosQr.length === 0) return;
  const marcadores = codigosQr.map(() => '?').join(', ');
  await db.runAsync(
    `UPDATE tickets SET pendiente_sync = 0 WHERE codigo_qr IN (${marcadores})`,
    codigosQr
  );
}

export type Resumen = {
  total: number;
  usadas: number;
  pendientes: number;
  mi_fila_total: number;
  mi_fila_usadas: number;
  ultima_descarga: string | null;
};

export async function obtenerResumen(db: SQLiteDatabase, fila: number): Promise<Resumen> {
  const conteos = await db.getFirstAsync<Omit<Resumen, 'ultima_descarga'>>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN estado = 'USADA' THEN 1 ELSE 0 END), 0) AS usadas,
       COALESCE(SUM(pendiente_sync), 0) AS pendientes,
       COALESCE(SUM(CASE WHEN fila_asignada = ? THEN 1 ELSE 0 END), 0) AS mi_fila_total,
       COALESCE(SUM(CASE WHEN fila_asignada = ? AND estado = 'USADA' THEN 1 ELSE 0 END), 0) AS mi_fila_usadas
     FROM tickets`,
    [fila, fila]
  );

  const meta = await db.getFirstAsync<{ valor: string }>(
    "SELECT valor FROM meta WHERE clave = 'ultima_descarga'"
  );

  return {
    total: conteos?.total ?? 0,
    usadas: conteos?.usadas ?? 0,
    pendientes: conteos?.pendientes ?? 0,
    mi_fila_total: conteos?.mi_fila_total ?? 0,
    mi_fila_usadas: conteos?.mi_fila_usadas ?? 0,
    ultima_descarga: meta?.valor ?? null,
  };
}

export async function borrarDatosLocales(db: SQLiteDatabase) {
  await db.execAsync('DELETE FROM tickets; DELETE FROM meta;');
}
