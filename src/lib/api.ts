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

/** GET /api/app/sync-download -> todas las entradas del evento (mapa offline completo). */
export async function syncDownload(token: string) {
  const datos = await pedir<{ tickets: TicketRemoto[] } | TicketRemoto[]>('/api/app/sync-download', {
    token,
  });
  return Array.isArray(datos) ? datos : datos.tickets;
}

/** POST /api/app/sync-upload -> ids de las entradas que este guardia marco como usadas offline. */
export function syncUpload(token: string, tickets: { id: string; fecha_escaneo: string }[]) {
  return pedir<{ procesados: number }>('/api/app/sync-upload', {
    metodo: 'POST',
    token,
    cuerpo: { tickets },
  });
}
