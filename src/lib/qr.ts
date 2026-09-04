import CryptoJS from 'crypto-js';

/**
 * OJO: las variables EXPO_PUBLIC_* se incrustan en el bundle JS, asi que este
 * secreto es extraible de un APK. Es el precio de poder validar sin conexion.
 * Conviene usar un secreto distinto por evento y que el backend siga siendo la
 * autoridad final cuando los escaneos se suben.
 */
const SECRETO = process.env.EXPO_PUBLIC_QR_SECRET ?? '';

/** Contenido del QR del cliente: {"id": "A1B2C3D4", "firma": "..."} */
type ContenidoQr = {
  id: string;
  firma: string;
};

export type MotivoInvalido = 'formato' | 'firma' | 'sin_secreto';

export type LecturaQr =
  | { valido: true; id: string }
  | { valido: false; motivo: MotivoInvalido };

export function firmarId(id: string, secreto: string = SECRETO) {
  return CryptoJS.HmacSHA256(id, secreto).toString(CryptoJS.enc.Hex);
}

export function leerQr(dato: string): LecturaQr {
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
  if (!SECRETO) return { valido: false, motivo: 'sin_secreto' };

  const esperada = firmarId(contenido.id);
  const recibida = contenido.firma.trim().toLowerCase();

  return esperada === recibida
    ? { valido: true, id: contenido.id }
    : { valido: false, motivo: 'firma' };
}
