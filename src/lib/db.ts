import type { SQLiteDatabase } from 'expo-sqlite';

import type { TicketLocal, TicketRemoto } from '@/lib/types';

const VERSION_ESQUEMA = 3;

/**
 * LIKE de SQLite no ignora acentos ni mayusculas fuera de ASCII: buscar "perez"
 * no encontraria "Pérez". Se guarda una copia normalizada para buscar sobre ella.
 */
function normalizar(texto: string | null) {
  if (!texto) return '';
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/** Texto sobre el que corre el buscador: nombre del comprador + numero de entrada. */
function textoBusqueda(ticket: TicketRemoto) {
  return normalizar(`${ticket.nombreComprador ?? ''} ${ticket.id}`);
}

export async function migrarBaseDeDatos(db: SQLiteDatabase) {
  const fila = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  if ((fila?.user_version ?? 0) >= VERSION_ESQUEMA) return;

  // Los esquemas previos usaban id entero. Se recrea la tabla en vez de migrarla:
  // las entradas son datos derivados que se vuelven a bajar con sync-download.
  await db.execAsync(`
    PRAGMA journal_mode = 'wal';

    DROP TABLE IF EXISTS tickets;

    CREATE TABLE tickets (
      id TEXT PRIMARY KEY NOT NULL,
      estado TEXT NOT NULL DEFAULT 'VALIDA',
      tipo TEXT,
      nombre_comprador TEXT,
      fila_asignada INTEGER,
      usada_at TEXT,
      pendiente_sync INTEGER NOT NULL DEFAULT 0,
      busqueda TEXT
    );

    CREATE INDEX idx_tickets_fila ON tickets (fila_asignada);
    CREATE INDEX idx_tickets_pendiente ON tickets (pendiente_sync);

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
      // El estado local es monotonico: una vez USADA, una descarga nunca la
      // vuelve a poner VALIDA. Sin esto, subir un escaneo y volver a descargar
      // enseguida (como hace sincronizarTodo) podia pisar el USADA recien
      // confirmado con datos del servidor que todavia no lo reflejaban
      // (lag de un instante entre sync-upload y que sync-download lo vea) y
      // el guardia perdia el escaneo aunque el backend lo hubiera aceptado.
      await db.runAsync(
        `INSERT INTO tickets (id, estado, tipo, nombre_comprador, fila_asignada, busqueda)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           tipo = excluded.tipo,
           nombre_comprador = excluded.nombre_comprador,
           fila_asignada = excluded.fila_asignada,
           busqueda = excluded.busqueda,
           estado = CASE WHEN tickets.estado = 'USADA' THEN 'USADA' ELSE excluded.estado END`,
        [
          ticket.id,
          ticket.estado,
          ticket.tipo,
          ticket.nombreComprador,
          ticket.filaAsignada,
          textoBusqueda(ticket),
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

export async function contarTickets(db: SQLiteDatabase) {
  const fila = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM tickets');
  return fila?.n ?? 0;
}

/**
 * Busca la entrada probando varias formas del mismo codigo, porque el id que
 * viaja en el QR y el que devuelve sync-download no siempre son identicos
 * (token completo vs codigo corto vs codigo con prefijo, y mayus/minus).
 * El codigo ya viene autenticado por HMAC, asi que ampliar la busqueda no
 * habilita nada: solo hace que encuentre la fila correcta.
 */
export function buscarTicketPorId(db: SQLiteDatabase, idsPosibles: string[]) {
  const variantes = new Set<string>();
  for (const id of idsPosibles) {
    const limpio = id?.trim();
    if (!limpio) continue;
    variantes.add(limpio);

    const sinPrefijo = limpio.match(/^[A-Za-z]{2,10}-(.+)$/);
    if (sinPrefijo) variantes.add(sinPrefijo[1]);
  }
  if (variantes.size === 0) return Promise.resolve(null);

  const lista = [...variantes];
  const marcadores = lista.map(() => '?').join(', ');
  return db.getFirstAsync<TicketLocal>(
    `SELECT * FROM tickets WHERE id COLLATE NOCASE IN (${marcadores}) LIMIT 1`,
    lista
  );
}

/**
 * Carga manual: el guardia lee el codigo corto impreso en la entrada y no puede
 * tipear la firma completa, asi que se busca por coincidencia parcial. Solo se
 * acepta si matchea UNA sola entrada, para no validar la equivocada.
 */
export async function buscarTicketPorCodigoParcial(db: SQLiteDatabase, codigo: string) {
  const limpio = codigo.trim();
  if (limpio.length < 4) return null;

  const filas = await db.getAllAsync<TicketLocal>(
    `SELECT * FROM tickets WHERE id LIKE ? COLLATE NOCASE LIMIT 2`,
    [`%${limpio}%`]
  );
  return filas.length === 1 ? filas[0] : null;
}

/** Ids de ejemplo de la base local, para diagnosticar desajustes de formato. */
export async function muestraDeIds(db: SQLiteDatabase, limite = 5) {
  const filas = await db.getAllAsync<{ id: string }>(
    'SELECT id FROM tickets ORDER BY id LIMIT ?',
    [limite]
  );
  return filas.map((f) => f.id);
}

/** Entradas de una fila, filtradas por nombre del comprador o numero de entrada. */
export function buscarTicketsDeFila(db: SQLiteDatabase, fila: number, texto: string) {
  const termino = normalizar(texto.trim());
  return db.getAllAsync<TicketLocal>(
    `SELECT * FROM tickets
     WHERE fila_asignada = ?
       AND (? = '' OR busqueda LIKE ?)
     ORDER BY nombre_comprador COLLATE NOCASE`,
    [fila, termino, `%${termino}%`]
  );
}

/** Marca la entrada como usada. Devuelve false si ya estaba marcada. */
export async function marcarTicketUsado(db: SQLiteDatabase, id: string) {
  const resultado = await db.runAsync(
    `UPDATE tickets
     SET estado = 'USADA', usada_at = ?, pendiente_sync = 1
     WHERE id = ? AND estado <> 'USADA' AND usada_at IS NULL`,
    [new Date().toISOString(), id]
  );
  return resultado.changes > 0;
}

export function obtenerPendientes(db: SQLiteDatabase) {
  return db.getAllAsync<{ id: string; usada_at: string }>(
    'SELECT id, usada_at FROM tickets WHERE pendiente_sync = 1'
  );
}

export async function limpiarPendientes(db: SQLiteDatabase, ids: string[]) {
  if (ids.length === 0) return;
  const marcadores = ids.map(() => '?').join(', ');
  await db.runAsync(`UPDATE tickets SET pendiente_sync = 0 WHERE id IN (${marcadores})`, ids);
}

export type Resumen = {
  total: number;
  usadas: number;
  pendientes: number;
  mi_fila_total: number;
  mi_fila_usadas: number;
  /** Entradas que llegaron sin fila asignada desde el backend. */
  sin_fila: number;
  ultima_descarga: string | null;
};

export async function obtenerResumen(db: SQLiteDatabase, fila: number): Promise<Resumen> {
  const conteos = await db.getFirstAsync<Omit<Resumen, 'ultima_descarga'>>(
    `SELECT
       COUNT(*) AS total,
       COALESCE(SUM(CASE WHEN estado = 'USADA' THEN 1 ELSE 0 END), 0) AS usadas,
       COALESCE(SUM(pendiente_sync), 0) AS pendientes,
       COALESCE(SUM(CASE WHEN fila_asignada = ? THEN 1 ELSE 0 END), 0) AS mi_fila_total,
       COALESCE(SUM(CASE WHEN fila_asignada = ? AND estado = 'USADA' THEN 1 ELSE 0 END), 0) AS mi_fila_usadas,
       COALESCE(SUM(CASE WHEN fila_asignada IS NULL THEN 1 ELSE 0 END), 0) AS sin_fila
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
    sin_fila: conteos?.sin_fila ?? 0,
    ultima_descarga: meta?.valor ?? null,
  };
}
