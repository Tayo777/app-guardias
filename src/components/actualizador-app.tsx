import { Ionicons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { Paleta, Spacing } from '@/constants/theme';
import { actualizacionesHabilitadas, verificarActualizaciones } from '@/lib/updates';

/** Cuanto se muestra el aviso "hay una actualizacion" antes de arrancar la descarga. */
const DEMORA_AVISO_MS = 1500;

/**
 * Chequea, descarga y ofrece aplicar actualizaciones OTA. Vive una sola vez en
 * el layout raiz: Updates.useUpdates() refleja el estado nativo sin importar
 * quien haya disparado checkForUpdateAsync (este componente al montarse, o el
 * boton manual de Mi Fila), asi que no hace falta prop-drilling.
 */
export function ActualizadorApp() {
  const { isUpdateAvailable, isUpdatePending, isDownloading, downloadProgress, downloadError } =
    Updates.useUpdates();

  const [mostrarAviso, setMostrarAviso] = useState(false);
  const [reiniciando, setReiniciando] = useState(false);
  const descargaIniciada = useRef(false);

  useEffect(() => {
    if (actualizacionesHabilitadas) verificarActualizaciones();
  }, []);

  useEffect(() => {
    if (!isUpdateAvailable || descargaIniciada.current) return;
    descargaIniciada.current = true;
    setMostrarAviso(true);

    // Se deja ver el aviso un instante antes de arrancar la descarga: si se
    // dispara al toque no da tiempo a leer "hay una actualizacion disponible".
    const temporizador = setTimeout(() => {
      setMostrarAviso(false);
      Updates.fetchUpdateAsync().catch(() => {
        descargaIniciada.current = false;
      });
    }, DEMORA_AVISO_MS);

    return () => clearTimeout(temporizador);
  }, [isUpdateAvailable]);

  async function aplicarAhora() {
    setReiniciando(true);
    try {
      await Updates.reloadAsync();
    } catch {
      setReiniciando(false);
    }
  }

  if (!actualizacionesHabilitadas) return null;

  const mostrarProgreso = isDownloading && !mostrarAviso;
  const mostrarListo = isUpdatePending && !isDownloading && !mostrarAviso;
  const visible = mostrarAviso || mostrarProgreso || mostrarListo;

  if (!visible || downloadError) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => {}}>
      <View style={styles.fondo}>
        <View style={styles.tarjeta}>
          {mostrarAviso && (
            <>
              <Ionicons name="cloud-download-outline" size={32} color={Paleta.primario} />
              <Text style={styles.titulo}>Actualización disponible</Text>
              <Text style={styles.texto}>
                Hay una nueva versión de la app. Se va a descargar sola, no hace falta hacer nada.
              </Text>
            </>
          )}

          {mostrarProgreso && (
            <>
              <ActivityIndicator size="large" color={Paleta.primario} />
              <Text style={styles.titulo}>Descargando actualización</Text>
              <Text style={styles.texto}>
                {typeof downloadProgress === 'number'
                  ? `${Math.round(downloadProgress * 100)}%`
                  : 'Iniciando descarga...'}
              </Text>
              <Text style={styles.textoChico}>Suele tardar menos de un minuto</Text>
            </>
          )}

          {mostrarListo && (
            <>
              <Text style={styles.titulo}>Actualización lista</Text>
              <Text style={styles.texto}>
                Hay que reiniciar la app para aplicarla. Lo escaneado hasta ahora no se pierde.
              </Text>
              <Pressable
                accessibilityRole="button"
                disabled={reiniciando}
                onPress={aplicarAhora}
                style={[styles.boton, { opacity: reiniciando ? 0.6 : 1 }]}>
                {reiniciando ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.textoBoton}>Reiniciar ahora</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fondo: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  tarjeta: {
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.two,
    alignItems: 'center',
  },
  titulo: { color: Paleta.texto, fontSize: 18, fontWeight: '800', textAlign: 'center' },
  texto: { color: Paleta.textoSuave, fontSize: 14, textAlign: 'center' },
  textoChico: { color: Paleta.textoSuave, fontSize: 12, textAlign: 'center' },
  boton: {
    backgroundColor: Paleta.primario,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.five,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 180,
    minHeight: 46,
    marginTop: Spacing.two,
  },
  textoBoton: { color: '#ffffff', fontWeight: '700' },
});
