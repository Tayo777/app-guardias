import CryptoJS from 'crypto-js';

type Extraccion = { id: string; firma: string; prefijo?: string };

/** Alias de nombre de campo que distintas versiones del backend pueden usar. */
const CLAVES_ID = ['id', 'ticketId', 'ticket_id', 'codigo', 'code'];
const CLAVES_FIRMA = ['firma', 'signature', 'hash', 'sig', 'token'];

function primerCampo(obj: Record<string, unknown>, claves: string[]): string | null {
  for (const clave of claves) {
    const valor = obj[clave];
    if (typeof valor === 'string' && valor.length > 0) return valor;
  }
  return null;
}

/** Caso puro: {"id": "A1B2C3D4", "firma": "..."} (o alias de esas claves). */
function extraerDeJson(dato: string): Extraccion | null {
  let obj: unknown;
  try {
    obj = JSON.parse(dato);
  } catch {
    return null;
  }
  if (!obj || typeof obj !== 'object') return null;

  const registro = obj as Record<string, unknown>;
  const id = primerCampo(registro, CLAVES_ID);
  const firma = primerCampo(registro, CLAVES_FIRMA);
  return id && firma ? { id, firma } : null;
}

/** Si `dato` es una URL, devuelve solo el path+resto (sin esquema ni host). */
function pathDeUrl(dato: string): string | null {
  if (!/^https?:\/\//i.test(dato)) return null;
  const sinEsquema = dato.replace(/^https?:\/\//i, '');
  const barra = sinEsquema.indexOf('/');
  return barra === -1 ? null : sinEsquema.slice(barra);
}

/**
 * Token tipo "EVT-DA2871B9.6d126ec81df99eab" (formato real observado en
 * produccion: .../validar/EVT-<id>.<firma>). Tambien tolera "-" como
 * separador entre id y firma. Se busca SOLO dentro del path de la URL (nunca
 * en el host), porque un host como "venta-tickets-production.up..." tiene
 * guiones propios que producen falsos matches si se busca en el string entero.
 */
function extraerDeToken(dato: string): Extraccion | null {
  const contenido = pathDeUrl(dato) ?? dato;
  const match = contenido.match(/([A-Za-z]{2,10})-([A-Za-z0-9]+)[.-]([A-Za-z0-9]+)/);
  if (!match) return null;
  const [, prefijo, id, firma] = match;
  return { id, firma, prefijo };
}

/** URL de validacion por query string: .../validar?id=A1B2C3D4&firma=abc123 */
function extraerDeQuery(dato: string): Extraccion | null {
  const [, query] = dato.split('?');
  if (!query) return null;

  const params = new Map<string, string>();
  for (const par of query.split('&')) {
    const [clave, valor] = par.split('=');
    if (!clave || valor === undefined) continue;
    try {
      params.set(clave.toLowerCase(), decodeURIComponent(valor));
    } catch {
      params.set(clave.toLowerCase(), valor);
    }
  }
  const id = CLAVES_ID.map((c) => params.get(c.toLowerCase())).find(Boolean);
  const firma = CLAVES_FIRMA.map((c) => params.get(c.toLowerCase())).find(Boolean);
  return id && firma ? { id, firma } : null;
}

/**
 * Prueba varias formas conocidas de empaquetar id+firma en el QR. Cada
 * estrategia es independiente: si una extrae mal, el peor caso es que la
 * firma no coincida despues y se rechace (falla cerrado, nunca abre de mas).
 */
function extraerIdYFirma(dato: string): Extraccion | null {
  return extraerDeJson(dato) ?? extraerDeToken(dato) ?? extraerDeQuery(dato);
}

type Candidato = { etiqueta: string; valor: string };

/**
 * No tenemos visibilidad del backend web, asi que en vez de apostar a una
 * unica combinacion algoritmo+encoding, se generan varios candidatos
 * plausibles y se acepta si CUALQUIERA coincide exactamente con la firma
 * recibida. Sigue siendo una comparacion criptografica real: sin el secreto
 * del evento ninguno de estos candidatos va a coincidir por azar.
 *
 * La firma real observada mide 16 hex (8 bytes) -> probablemente un HMAC
 * truncado para que el QR sea mas corto, de ahi los slice(0, N).
 */
function candidatosFirma(id: string, idConPrefijo: string | null, secreto: string): Candidato[] {
  const entradas = [
    { etiqueta: 'id', texto: id },
    ...(idConPrefijo ? [{ etiqueta: idConPrefijo.split('-')[0] + '-id', texto: idConPrefijo }] : []),
  ];

  const candidatos: Candidato[] = [];
  for (const { etiqueta, texto } of entradas) {
    const mac = CryptoJS.HmacSHA256(texto, secreto);
    const hex = mac.toString(CryptoJS.enc.Hex);
    const base64 = mac.toString(CryptoJS.enc.Base64);

    candidatos.push(
      { etiqueta: `HMAC(${etiqueta}) hex`, valor: hex },
      { etiqueta: `HMAC(${etiqueta}) hex[:16]`, valor: hex.slice(0, 16) },
      { etiqueta: `HMAC(${etiqueta}) hex[:32]`, valor: hex.slice(0, 32) },
      { etiqueta: `HMAC(${etiqueta}) base64`, valor: base64 },
      { etiqueta: `HMAC(${etiqueta}) base64 sin =`, valor: base64.replace(/=+$/, '') }
    );
  }
  return candidatos;
}

function coincideFlexible(a: string, b: string) {
  return a === b || a.toLowerCase() === b.toLowerCase();
}

export type LecturaQr =
  | { valido: true; id: string }
  | { valido: false; motivo: 'formato'; crudo: string }
  | { valido: false; motivo: 'sin_secreto'; id: string }
  | { valido: false; motivo: 'firma'; id: string; firmaRecibida: string; candidatos: Candidato[] };

export type MotivoInvalido = Exclude<LecturaQr, { valido: true }>['motivo'];

/**
 * Valida la firma del QR contra el secreto del evento, que llega en el login y
 * vive en la sesion del guardia. La app no conoce ningun secreto de antemano:
 * sirve para cualquier evento sin recompilar.
 *
 * Devuelve info de diagnostico (nunca el secreto) para poder distinguir en la
 * UI un QR realmente adulterado de un problema de configuracion o de formato.
 */
export function leerQr(dato: string, secreto: string | null): LecturaQr {
  const extraccion = extraerIdYFirma(dato.trim());
  if (!extraccion) return { valido: false, motivo: 'formato', crudo: dato };

  const { id, firma, prefijo } = extraccion;

  // Sin secreto no se puede distinguir un QR legitimo de uno falso: se rechaza,
  // porque dar acceso seria peor que un falso negativo. Esto NO es un QR
  // adulterado: es que la sesion del guardia no tiene el secreto del evento.
  if (!secreto) return { valido: false, motivo: 'sin_secreto', id };

  const idConPrefijo = prefijo ? `${prefijo}-${id}` : null;
  const candidatos = candidatosFirma(id, idConPrefijo, secreto);
  const recibida = firma.trim();
  const coincide = candidatos.some((c) => coincideFlexible(c.valor, recibida));

  if (!coincide) {
    return { valido: false, motivo: 'firma', id, firmaRecibida: recibida, candidatos };
  }

  return { valido: true, id };
}
