/**
 * URL del backend Node/Express.
 *
 * Para probar en celular fisico o emulador, ambos tienen que estar en la MISMA red Wi-Fi
 * que la PC, y hay que apuntar a la IP local de la PC (no `localhost`: el telefono
 * resolveria localhost contra si mismo).
 *
 * Como obtener la IP en Windows:  ipconfig   ->  "Direccion IPv4" del adaptador Wi-Fi
 * Despues, crear un archivo .env en la raiz con:
 *
 *   EXPO_PUBLIC_API_URL=http://192.168.1.35:3000
 *
 * Hay que reiniciar el server de Expo despues de cambiar el .env.
 */
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://192.168.1.100:3000';

/** Corta el fetch si el backend no responde: sin esto la app se cuelga fuera de la red. */
export const TIMEOUT_MS = 10_000;

export const DATABASE_NAME = 'guardias.db';
