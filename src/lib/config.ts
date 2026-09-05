/**
 * URL del backend Node/Express.
 *
 * En desarrollo se define en .env (hay que REINICIAR el server de Expo al cambiarla).
 * En builds de EAS, .env no se sube (esta en .gitignore), asi que el valor tiene que
 * estar en el bloque "env" del perfil correspondiente de eas.json.
 *
 * Para probar en celular fisico, la PC y el telefono tienen que estar en la misma
 * Wi-Fi y hay que usar la IP local de la PC (`ipconfig`), no localhost.
 *
 * A proposito no hay valor por defecto: una IP hardcodeada de respaldo hace que la
 * app falle contra un host equivocado en vez de avisar que falta configurarla.
 */
function leerConfigApi() {
  const valor = process.env.EXPO_PUBLIC_API_URL?.trim();

  if (!valor) {
    return {
      url: '',
      error:
        'Falta EXPO_PUBLIC_API_URL. En desarrollo definila en .env y reinicia Expo; ' +
        'en un build de EAS tiene que estar en el bloque "env" de eas.json.',
    };
  }

  if (!/^https?:\/\//i.test(valor)) {
    return {
      url: valor,
      error: `EXPO_PUBLIC_API_URL no es una URL valida: "${valor}". Tiene que empezar con http:// o https://`,
    };
  }

  return { url: valor.replace(/\/+$/, ''), error: null };
}

const config = leerConfigApi();

export const API_BASE_URL = config.url;
/** Mensaje listo para mostrar si la URL falta o esta mal escrita; null si esta bien. */
export const ERROR_CONFIG_API = config.error;

/** Corta el fetch si el backend no responde: sin esto la app se cuelga fuera de la red. */
export const TIMEOUT_MS = 10_000;

export const DATABASE_NAME = 'guardias.db';
