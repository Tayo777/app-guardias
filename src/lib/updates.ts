import * as Updates from 'expo-updates';

/**
 * OTA no funciona en Expo Go ni en un build de desarrollo sin runtime propio:
 * checkForUpdateAsync() directamente tira excepcion en __DEV__. Updates.isEnabled
 * cubre ademas los casos donde la config nativa de updates esta mal armada.
 */
export const actualizacionesHabilitadas = !__DEV__ && Updates.isEnabled;

/**
 * Dispara la verificacion contra el servidor de EAS. No hace falta reaccionar
 * al resultado aca: el componente <ActualizadorApp/> escucha Updates.useUpdates()
 * en cualquier parte del arbol y muestra el modal si corresponde.
 */
export async function verificarActualizaciones() {
  if (!actualizacionesHabilitadas) {
    return { disponible: false as const, motivo: 'deshabilitado' as const };
  }
  try {
    const resultado = await Updates.checkForUpdateAsync();
    return { disponible: resultado.isAvailable, motivo: null };
  } catch (e) {
    return {
      disponible: false as const,
      motivo: e instanceof Error ? e.message : 'error desconocido',
    };
  }
}
