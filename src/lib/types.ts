export type EstadoTicket = 'VALIDA' | 'USADA';

/**
 * Se detecta por el campo `tipo` (ej: "Cortesia", "CORTESÍA VIP"), no por falta
 * de nombre: un ticket pago sin nombre cargado no es lo mismo que un regalo, y
 * confundirlos en la UI podria hacer parecer que hay mas cortesias de las que
 * hay en la recaudacion que calcula el panel web.
 */
export function esCortesia(ticket: { tipo: string | null }): boolean {
  return !!ticket.tipo && /cortes[ií]a/i.test(ticket.tipo);
}

export function nombreParaMostrar(ticket: { nombre_comprador?: string | null; tipo: string | null }): string {
  if (esCortesia(ticket)) return 'Entrada de Cortesía';
  return ticket.nombre_comprador ?? 'Sin nombre';
}

/** Ticket tal como lo devuelve el backend en /api/app/sync-download (camelCase). */
export type TicketRemoto = {
  /** Alfanumerico, ej "A1B2C3D4". */
  id: string;
  estado: EstadoTicket;
  tipo: string | null;
  nombreComprador: string | null;
  filaAsignada: number | null;
  dni: string | null;
  email: string | null;
  /** ISO date de cuando se compro/genero la entrada (no cuando se escaneo). */
  fechaCompra: string | null;
};

/** Ticket tal como vive en la base SQLite del telefono (snake_case). */
export type TicketLocal = {
  id: string;
  estado: EstadoTicket;
  tipo: string | null;
  nombre_comprador: string | null;
  fila_asignada: number | null;
  dni: string | null;
  email: string | null;
  fecha_compra: string | null;
  /** ISO date del momento en que se escaneo en este dispositivo. */
  usada_at: string | null;
  /** 1 = escaneado local todavia no subido al backend. */
  pendiente_sync: number;
};
