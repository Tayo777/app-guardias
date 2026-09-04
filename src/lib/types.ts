export type EstadoTicket = 'VALIDA' | 'USADA';

/** Ticket tal como lo devuelve el backend en /api/app/sync-download (camelCase). */
export type TicketRemoto = {
  /** Alfanumerico, ej "A1B2C3D4". */
  id: string;
  estado: EstadoTicket;
  tipo: string | null;
  nombreComprador: string | null;
  filaAsignada: number | null;
};

/** Ticket tal como vive en la base SQLite del telefono (snake_case). */
export type TicketLocal = {
  id: string;
  estado: EstadoTicket;
  tipo: string | null;
  nombre_comprador: string | null;
  fila_asignada: number | null;
  /** ISO date del momento en que se escaneo en este dispositivo. */
  usada_at: string | null;
  /** 1 = escaneado local todavia no subido al backend. */
  pendiente_sync: number;
};
