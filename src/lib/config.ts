// Definir EXPO_PUBLIC_API_URL en .env apuntando al backend Node/Express.
// En dispositivo fisico no sirve localhost: usar la IP de la PC en la LAN.
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

export const DATABASE_NAME = 'guardias.db';
