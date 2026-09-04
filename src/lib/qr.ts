import CryptoJS from 'crypto-js';

/** Contenido del QR del cliente: {"id": "A1B2C3D4", "firma": "..."} */
type ContenidoQr = {
  id: string;
  firma: string;
};

export type MotivoInvalido = 'formato' | 'firma' | 'sin_secreto';

export type LecturaQr =
  | { valido: true; id: string }
  | { valido: false; motivo: MotivoInvalido };

export function firmarId(id: string, secreto: string) {
  return CryptoJS.HmacSHA256(id, secreto).toString(CryptoJS.enc.Hex);
}

/**
 * Valida la firma del QR contra el secreto del evento, que llega en el login y
 * vive en la sesion del guardia. La app no conoce ningun secreto de antemano:
 * sirve para cualquier evento sin recompilar.
 */
export function leerQr(dato: string, secreto: string | null): LecturaQr {
  let contenido: ContenidoQr;
  try {
    contenido = JSON.parse(dato);
  } catch {
    return { valido: false, motivo: 'formato' };
  }

  if (typeof contenido?.id !== 'string' || typeof contenido?.firma !== 'string') {
    return { valido: false, motivo: 'formato' };
  }

  // Sin secreto no se puede distinguir un QR legitimo de uno falso: se rechaza,
  // porque dar acceso seria peor que un falso negativo.
  if (!secreto) return { valido: false, motivo: 'sin_secreto' };

  const esperada = firmarId(contenido.id, secreto);
  const recibida = contenido.firma.trim().toLowerCase();

  return esperada === recibida
    ? { valido: true, id: contenido.id }
    : { valido: false, motivo: 'firma' };
}
