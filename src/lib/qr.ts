import CryptoJS from 'crypto-js';

type Extraccion = { id: string; firma: string };

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

/**
 * URL de validacion: https://.../validar?id=A1B2C3D4&firma=abc123
 * o por path: https://.../validar/A1B2C3D4/abc123
 */
function extraerDeUrl(dato: string): Extraccion | null {
  if (!/^https?:\/\//i.test(dato)) return null;

  const [ruta, query = ''] = dato.split('?');

  if (query) {
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
    if (id && firma) return { id, firma };
  }

  // Sin query util: probar los dos ultimos segmentos del path como id/firma.
  const segmentos = ruta.split('/').filter(Boolean);
  if (segmentos.length >= 2) {
    const firma = segmentos[segmentos.length - 1];
    const id = segmentos[segmentos.length - 2];
    if (id && firma && !/^https?:$/i.test(id)) return { id, firma };
  }

  return null;
}

/** Prefijo tipo "EVT-A1B2C3D4-9f8e7d6c...": <PREFIJO>-<id>-<firma>. */
function extraerDePrefijo(dato: string): Extraccion | null {
  const partes = dato.split('-');
  if (partes.length < 3) return null;
  if (!/^[A-Za-z]+$/.test(partes[0])) return null;

  const firma = partes[partes.length - 1];
  const id = partes.slice(1, -1).join('-');
  return id && firma ? { id, firma } : null;
}

/**
 * Prueba varias formas conocidas de empaquetar id+firma en el QR. Cada
 * estrategia es independiente: si una extrae mal, el peor caso es que la
 * firma no coincida despues y se rechace (falla cerrado, nunca abre de mas).
 */
function extraerIdYFirma(dato: string): Extraccion | null {
  return extraerDeJson(dato) ?? extraerDeUrl(dato) ?? extraerDePrefijo(dato);
}

export type LecturaQr =
  | { valido: true; id: string }
  | { valido: false; motivo: 'formato'; crudo: string }
  | { valido: false; motivo: 'sin_secreto'; id: string }
  | { valido: false; motivo: 'firma'; id: string; firmaRecibida: string; firmaEsperada: string };

export type MotivoInvalido = Exclude<LecturaQr, { valido: true }>['motivo'];

export function firmarId(id: string, secreto: string) {
  return CryptoJS.HmacSHA256(id, secreto).toString(CryptoJS.enc.Hex);
}

/**
 * Compara la firma recibida contra el HMAC-SHA256 del id. Se prueba en hex y
 * en base64 (con y sin padding) porque no tenemos visibilidad del backend web
 * y distintos generadores de QR suelen diferir solo en el encoding de salida,
 * no en el algoritmo. Sigue siendo una comparacion criptografica exacta: sin
 * el secreto correcto ninguna de las variantes va a coincidir.
 */
function firmasCoinciden(firmaRecibida: string, id: string, secreto: string): boolean {
  const mac = CryptoJS.HmacSHA256(id, secreto);
  const hex = mac.toString(CryptoJS.enc.Hex).toLowerCase();
  const base64 = mac.toString(CryptoJS.enc.Base64);

  const recibida = firmaRecibida.trim();
  const recibidaSinPadding = recibida.replace(/=+$/, '');

  return (
    recibida.toLowerCase() === hex ||
    recibida === base64 ||
    recibidaSinPadding === base64.replace(/=+$/, '')
  );
}

/**
 * Valida la firma del QR contra el secreto del evento, que llega en el login y
 * vive en la sesion del guardia. La app no conoce ningun secreto de antemano:
 * sirve para cualquier evento sin recompilar.
 *
 * Devuelve info de diagnostico (nunca el secreto) para poder distinguir en la
 * UI un QR realmente adulterado de un problema de configuracion o de formato,
 * que son casos muy distintos y NO deberian alarmar igual a un guardia.
 */
export function leerQr(dato: string, secreto: string | null): LecturaQr {
  const extraccion = extraerIdYFirma(dato.trim());
  if (!extraccion) return { valido: false, motivo: 'formato', crudo: dato };

  const { id, firma } = extraccion;

  // Sin secreto no se puede distinguir un QR legitimo de uno falso: se rechaza,
  // porque dar acceso seria peor que un falso negativo. Esto NO es un QR
  // adulterado: es que la sesion del guardia no tiene el secreto del evento.
  if (!secreto) return { valido: false, motivo: 'sin_secreto', id };

  if (!firmasCoinciden(firma, id, secreto)) {
    return {
      valido: false,
      motivo: 'firma',
      id,
      firmaRecibida: firma,
      firmaEsperada: firmarId(id, secreto),
    };
  }

  return { valido: true, id };
}
