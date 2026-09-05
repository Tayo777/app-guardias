import CryptoJS from 'crypto-js';

/** Contenido del QR del cliente: {"id": "A1B2C3D4", "firma": "..."} */
type ContenidoQr = {
  id: string;
  firma: string;
};

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
 * Valida la firma del QR contra el secreto del evento, que llega en el login y
 * vive en la sesion del guardia. La app no conoce ningun secreto de antemano:
 * sirve para cualquier evento sin recompilar.
 *
 * Devuelve info de diagnostico (nunca el secreto) para poder distinguir en la
 * UI un QR realmente adulterado de un problema de configuracion o de formato,
 * que son casos muy distintos y NO deberian alarmar igual a un guardia.
 */
export function leerQr(dato: string, secreto: string | null): LecturaQr {
  let contenido: ContenidoQr;
  try {
    contenido = JSON.parse(dato);
  } catch {
    return { valido: false, motivo: 'formato', crudo: dato };
  }

  if (typeof contenido?.id !== 'string' || typeof contenido?.firma !== 'string') {
    return { valido: false, motivo: 'formato', crudo: dato };
  }

  // Sin secreto no se puede distinguir un QR legitimo de uno falso: se rechaza,
  // porque dar acceso seria peor que un falso negativo. Esto NO es un QR
  // adulterado: es que la sesion del guardia no tiene el secreto del evento.
  if (!secreto) return { valido: false, motivo: 'sin_secreto', id: contenido.id };

  const esperada = firmarId(contenido.id, secreto);
  const recibida = contenido.firma.trim().toLowerCase();

  if (esperada !== recibida) {
    return {
      valido: false,
      motivo: 'firma',
      id: contenido.id,
      firmaRecibida: recibida,
      firmaEsperada: esperada,
    };
  }

  return { valido: true, id: contenido.id };
}
