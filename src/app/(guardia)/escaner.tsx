import { CameraView, useCameraPermissions } from 'expo-camera';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { buscarTicketPorQr, marcarTicketUsado } from '@/lib/db';
import { useSesion } from '@/lib/session';
import type { TicketLocal } from '@/lib/types';

type Resultado =
  | { tipo: 'valida'; ticket: TicketLocal }
  | { tipo: 'usada'; ticket: TicketLocal }
  | { tipo: 'otra_fila'; ticket: TicketLocal }
  | { tipo: 'inexistente'; codigo: string };

const COLORES: Record<Resultado['tipo'], string> = {
  valida: '#16a34a',
  usada: '#dc2626',
  otra_fila: '#d97706',
  inexistente: '#dc2626',
};

const TITULOS: Record<Resultado['tipo'], string> = {
  valida: 'ENTRADA VALIDA',
  usada: 'YA UTILIZADA',
  otra_fila: 'OTRA FILA',
  inexistente: 'ENTRADA INEXISTENTE',
};

export default function EscanerScreen() {
  const db = useSQLiteContext();
  const { sesion } = useSesion();
  const fila = sesion?.guardia.fila_asignada ?? 0;

  const [permiso, pedirPermiso] = useCameraPermissions();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);

  async function validar(ticket: TicketLocal) {
    const marcado = await marcarTicketUsado(db, ticket.codigo_qr, fila);
    const actualizado = (await buscarTicketPorQr(db, ticket.codigo_qr)) ?? ticket;
    setResultado({ tipo: marcado ? 'valida' : 'usada', ticket: actualizado });
  }

  async function alEscanear(codigo: string) {
    if (procesando || resultado) return;
    setProcesando(true);
    try {
      const ticket = await buscarTicketPorQr(db, codigo);
      if (!ticket) {
        setResultado({ tipo: 'inexistente', codigo });
      } else if (ticket.estado === 'USADA') {
        setResultado({ tipo: 'usada', ticket });
      } else if (ticket.fila_asignada !== null && ticket.fila_asignada !== fila) {
        setResultado({ tipo: 'otra_fila', ticket });
      } else {
        await validar(ticket);
      }
    } finally {
      setProcesando(false);
    }
  }

  if (!permiso) return <ThemedView style={styles.container} />;

  if (!permiso.granted) {
    return (
      <ThemedView style={[styles.container, styles.centrado]}>
        <ThemedText type="default" style={styles.textoCentrado}>
          Necesitamos acceso a la camara para escanear las entradas.
        </ThemedText>
        <Pressable accessibilityRole="button" onPress={pedirPermiso} style={styles.botonAzul}>
          <ThemedText type="smallBold" style={styles.textoBoton}>
            Permitir camara
          </ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={resultado ? undefined : ({ data }) => alEscanear(data)}
      />

      {!resultado && (
        <SafeAreaView style={styles.guiaContenedor} pointerEvents="none">
          <View style={styles.guia} />
          <ThemedText type="smallBold" style={styles.guiaTexto}>
            Apunta al QR de la entrada
          </ThemedText>
        </SafeAreaView>
      )}

      {resultado && (
        <SafeAreaView style={styles.panelContenedor}>
          <View style={[styles.panel, { backgroundColor: COLORES[resultado.tipo] }]}>
            <ThemedText type="subtitle" style={styles.panelTitulo}>
              {TITULOS[resultado.tipo]}
            </ThemedText>

            {resultado.tipo === 'inexistente' ? (
              <ThemedText type="small" style={styles.panelTexto}>
                Codigo {resultado.codigo} no pertenece a este evento.
              </ThemedText>
            ) : (
              <View style={styles.panelDetalle}>
                <ThemedText type="smallBold" style={styles.panelTexto}>
                  {resultado.ticket.nombre_cliente ?? 'Sin nombre'}
                </ThemedText>
                <ThemedText type="small" style={styles.panelTexto}>
                  {resultado.ticket.tipo_entrada ?? 'Entrada general'}
                  {resultado.ticket.fila_asignada !== null &&
                    `  ·  Fila ${resultado.ticket.fila_asignada}`}
                </ThemedText>
                {resultado.tipo === 'usada' && resultado.ticket.usada_at && (
                  <ThemedText type="small" style={styles.panelTexto}>
                    Utilizada el {new Date(resultado.ticket.usada_at).toLocaleString()}
                  </ThemedText>
                )}
                {resultado.tipo === 'otra_fila' && (
                  <ThemedText type="small" style={styles.panelTexto}>
                    Corresponde a la fila {resultado.ticket.fila_asignada}, vos sos la {fila}.
                  </ThemedText>
                )}
              </View>
            )}

            <View style={styles.panelAcciones}>
              {resultado.tipo === 'otra_fila' && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => validar(resultado.ticket)}
                  style={styles.botonPanel}>
                  <ThemedText type="smallBold" style={styles.textoBotonPanel}>
                    Validar igual
                  </ThemedText>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => setResultado(null)}
                style={styles.botonPanel}>
                <ThemedText type="smallBold" style={styles.textoBotonPanel}>
                  Escanear siguiente
                </ThemedText>
              </Pressable>
            </View>
          </View>
        </SafeAreaView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000000' },
  centrado: { justifyContent: 'center', alignItems: 'center', gap: Spacing.three, padding: Spacing.four },
  textoCentrado: { textAlign: 'center' },
  botonAzul: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  textoBoton: { color: '#ffffff' },
  guiaContenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  guia: {
    width: 240,
    height: 240,
    borderRadius: Spacing.four,
    borderWidth: 3,
    borderColor: '#ffffff',
  },
  guiaTexto: { color: '#ffffff' },
  panelContenedor: { flex: 1, justifyContent: 'flex-end', padding: Spacing.three },
  panel: { borderRadius: Spacing.four, padding: Spacing.four, gap: Spacing.three },
  panelTitulo: { color: '#ffffff' },
  panelDetalle: { gap: Spacing.one },
  panelTexto: { color: '#ffffff' },
  panelAcciones: { gap: Spacing.two },
  botonPanel: {
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  textoBotonPanel: { color: '#ffffff' },
});
