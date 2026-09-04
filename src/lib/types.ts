export type EstadoTicket = 'VALIDA' | 'USADA';

/** Ticket tal como lo devuelve el backend en /api/app/sync-download. */
export type TicketRemoto = {
  id: number;
  codigo_qr: string;
  tipo_entrada: string | null;
  nombre_cliente: string | null;
  estado: EstadoTicket;
  fila_asignada: number | null;
};

/** Ticket tal como vive en la base SQLite del telefono. */
export type TicketLocal = TicketRemoto & {
  /** ISO date del momento en que este guardia lo marco como usado. */
  usada_at: string | null;
  usada_por_fila: number | null;
  /** 1 = escaneado local todavia no subido al backend. */
  pendiente_sync: number;
};

export type Guardia = {
  id: number;
  email: string;
  nombre: string | null;
  fila_asignada: number;
  evento_id: number | null;
};

export type Sesion = {
  token: string;
  guardia: Guardia;
};
