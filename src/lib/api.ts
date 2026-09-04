import { API_BASE_URL, TIMEOUT_MS } from '@/lib/config';
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
  const abortador = new AbortController();
  const temporizador = setTimeout(() => abortador.abort(), TIMEOUT_MS);

  let respuesta: Response;
  try {
    respuesta = await fetch(`${API_BASE_URL}${ruta}`, {
      method: metodo,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      signal: abortador.signal,
    });
  } catch {
    throw new ApiError(`No se pudo conectar con ${API_BASE_URL}`, 0);
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
};

/** POST /api/app/login -> JWT + la fila que le toca cubrir al guardia. */
export function login(email: string, password: string) {
  return pedir<RespuestaLogin>('/api/app/login', {
    metodo: 'POST',
    cuerpo: { email, password },
  });
}

/** GET /api/app/sync-download -> todas las entradas del evento (mapa offline completo). */
export async function syncDownload(token: string) {
  const datos = await pedir<{ tickets: TicketRemoto[] } | TicketRemoto[]>('/api/app/sync-download', {
    token,
  });
  return Array.isArray(datos) ? datos : datos.tickets;
}

/** POST /api/app/sync-upload -> entradas que este guardia marco como usadas offline. */
export function syncUpload(token: string, tickets: { codigo_qr: string; usada_at: string }[]) {
  return pedir<{ procesados: number }>('/api/app/sync-upload', {
    metodo: 'POST',
    token,
    cuerpo: { tickets },
  });
}
