import { API_BASE_URL, ERROR_CONFIG_API, TIMEOUT_MS } from '@/lib/config';
import type { TicketRemoto } from '@/lib/types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type Opciones = {
  metodo?: 'GET' | 'POST';
  token?: string;
  cuerpo?: unknown;
};

async function pedir<T>(ruta: string, { metodo = 'GET', token, cuerpo }: Opciones = {}): Promise<T> {
  if (ERROR_CONFIG_API) throw new ApiError(ERROR_CONFIG_API, 0);

  const url = `${API_BASE_URL}${ruta}`;
  const abortador = new AbortController();
  const temporizador = setTimeout(() => abortador.abort(), TIMEOUT_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(url, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: abortador.signal,
    });
  } catch {
    // La URL completa en el mensaje: sin esto, diagnosticar "Network Error"
    // en un celular sin devtools es adivinar.
    throw new ApiError(
      abortador.signal.aborted
        ? `El servidor no respondió en ${TIMEOUT_MS / 1000}s: ${url}`
        : `No se pudo conectar con ${url}`,
      0
    );
  } finally {
    clearTimeout(temporizador);
  }

  const texto = await respuesta.text();
  const datos = texto ? JSON.parse(texto) : null;

  if (!respuesta.ok) {
    throw new ApiError(datos?.message ?? `Error ${respuesta.status}`, respuesta.status);
  }
  return datos as T;
}

/** Respuesta plana en camelCase, tal como la devuelve el backend. */
export type RespuestaLogin = {
  token: string;
  filaAsignada: number;
  eventoId: number;
  eventoNombre: string;
  /** Secreto HMAC de ESTE evento, para validar las firmas de los QR sin conexion. */
  qrSecret: string;
};

/** POST /api/app/login -> JWT + la fila que le toca cubrir al guardia. */
export function login(email: string, password: string) {
  return pedir<RespuestaLogin>('/api/app/login', {
    metodo: 'POST',
    cuerpo: { email, password },
  });
}

function primerValor(crudo: Record<string, unknown>, claves: string[]): unknown {
  for (const clave of claves) {
    const valor = crudo[clave];
    if (valor !== undefined && valor !== null) return valor;
  }
  return null;
}

function comoTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return typeof valor === 'string' ? valor : String(valor);
}

function comoNumero(valor: unknown): number | null {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizarEstado(crudo: Record<string, unknown>): 'VALIDA' | 'USADA' {
  const estado = comoTexto(primerValor(crudo, ['estado', 'status', 'state']));
  if (estado && /usad|used/i.test(estado)) return 'USADA';
  if (estado && /valid|disponible|activa/i.test(estado)) return 'VALIDA';

  if (primerValor(crudo, ['usadaAt', 'usada_at', 'fechaEscaneo', 'fecha_escaneo'])) return 'USADA';
  if (primerValor(crudo, ['usada', 'usado', 'used']) === true) return 'USADA';

  return 'VALIDA';
}

/**
 * El backend cambio de forma varias veces (camelCase vs snake_case, id corto vs
 * token completo). Se normaliza en el borde para que el resto de la app trabaje
 * siempre con la misma estructura, en vez de propagar el desajuste a SQLite.
 */
function normalizarTicket(crudo: Record<string, unknown>): TicketRemoto | null {
  const id = comoTexto(primerValor(crudo, ['id', 'ticketId', 'ticket_id', 'codigo', 'code']));
  if (!id) return null;

  return {
    id,
    estado: normalizarEstado(crudo),
    tipo: comoTexto(primerValor(crudo, ['tipo', 'tipoEntrada', 'tipo_entrada', 'type'])),
    nombreComprador: comoTexto(
      primerValor(crudo, ['nombreComprador', 'nombre_comprador', 'comprador', 'nombre'])
    ),
    filaAsignada: comoNumero(
      primerValor(crudo, ['filaAsignada', 'fila_asignada', 'fila', 'row'])
    ),
    dni: comoTexto(primerValor(crudo, ['dni', 'documento', 'doc', 'nroDocumento', 'nro_documento'])),
    email: comoTexto(primerValor(crudo, ['email', 'mail', 'correo'])),
    fechaCompra: comoTexto(
      primerValor(crudo, [
        'fechaCompra',
        'fecha_compra',
        'fechaDeCompra',
        'createdAt',
        'created_at',
        'fechaCreacion',
        'fecha_creacion',
      ])
    ),
  };
}

/** GET /api/app/sync-download -> todas las entradas del evento (mapa offline completo). */
export async function syncDownload(token: string) {
  const datos = await pedir<unknown>('/api/app/sync-download', { token });

  const crudos = Array.isArray(datos)
    ? datos
    : ((datos as { tickets?: unknown[]; entradas?: unknown[] })?.tickets ??
      (datos as { entradas?: unknown[] })?.entradas ??
      []);

  return crudos
    .map((t) => normalizarTicket(t as Record<string, unknown>))
    .filter((t): t is TicketRemoto => t !== null);
}

export type TicketSubida = {
  /** Id tal como lo guarda la app: el token completo del QR. */
  id: string;
  /** Mismo valor bajo otro nombre, por si el backend lo indexa como "codigo". */
  codigo: string;
  /** Parte corta del token ("CE80AE28"), por si el backend guarda solo eso. */
  codigo_corto: string | null;
  fecha_escaneo: string;
};

export type RespuestaSyncUpload = {
  procesados?: number;
  actualizados?: number;
  ok?: boolean;
  /** Algunos backends devuelven que ids aplicaron y cuales no reconocieron. */
  ids?: string[];
  noEncontrados?: string[];
  [clave: string]: unknown;
};

/** POST /api/app/sync-upload -> entradas que este guardia marco como usadas offline. */
export function syncUpload(token: string, tickets: TicketSubida[]) {
  return pedir<RespuestaSyncUpload>('/api/app/sync-upload', {
    metodo: 'POST',
    token,
    cuerpo: { tickets },
  });
}
