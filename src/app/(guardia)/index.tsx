import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Paleta, Spacing } from '@/constants/theme';
import { buscarTicketPorQr, contarTickets, marcarTicketUsado } from '@/lib/db';
import type { TicketLocal } from '@/lib/types';
import { useAuthStore } from '@/store/auth';

type Resultado =
  | { tipo: 'valida'; ticket: TicketLocal }
  | { tipo: 'usada'; ticket: TicketLocal }
  | { tipo: 'otra_fila'; ticket: TicketLocal }
  | { tipo: 'inexistente'; codigo: string };

const ESTILO_RESULTADO: Record<Resultado['tipo'], { color: string; titulo: string; icono: 'checkmark-circle' | 'close-circle' | 'warning' }> = {
  valida: { color: Paleta.exito, titulo: 'ENTRADA VÁLIDA', icono: 'checkmark-circle' },
  usada: { color: Paleta.error, titulo: 'YA UTILIZADA', icono: 'close-circle' },
  otra_fila: { color: Paleta.alerta, titulo: 'OTRA FILA', icono: 'warning' },
  inexistente: { color: Paleta.error, titulo: 'ENTRADA INEXISTENTE', icono: 'close-circle' },
};

export default function EscanerScreen() {
  const db = useSQLiteContext();
  const miNumeroDeFila = useAuthStore((estado) => estado.miNumeroDeFila) ?? 0;

  const [permiso, pedirPermiso] = useCameraPermissions();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const [sinEntradas, setSinEntradas] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setEnfocado(true);
      contarTickets(db).then((cantidad) => setSinEntradas(cantidad === 0));
      return () => setEnfocado(false);
    }, [db])
  );

  async function validar(ticket: TicketLocal) {
    const marcado = await marcarTicketUsado(db, ticket.codigo_qr, miNumeroDeFila);
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
      } else if (ticket.fila_asignada !== null && ticket.fila_asignada !== miNumeroDeFila) {
        setResultado({ tipo: 'otra_fila', ticket });
      } else {
        await validar(ticket);
      }
    } finally {
      setProcesando(false);
    }
  }

  if (!permiso) return <View style={styles.raiz} />;

  if (!permiso.granted) {
    return (
      <View style={[styles.raiz, styles.centrado]}>
        <Ionicons name="camera-outline" size={40} color={Paleta.textoSuave} />
        <Text style={styles.textoPermiso}>
          Necesitamos acceso a la cámara para escanear los QR de las entradas.
        </Text>
        <Pressable accessibilityRole="button" onPress={pedirPermiso} style={styles.botonPrimario}>
          <Text style={styles.textoBotonPrimario}>Permitir cámara</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.raiz}>
      {enfocado && (
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={resultado ? undefined : ({ data }) => alEscanear(data)}
        />
      )}

      {!resultado && (
        <View style={styles.guiaContenedor} pointerEvents="none">
          <View style={styles.guia} />
          <Text style={styles.guiaTexto}>Apuntá al QR de la entrada</Text>
        </View>
      )}

      {sinEntradas && !resultado && (
        <View style={styles.avisoSinDatos}>
          <Ionicons name="cloud-download-outline" size={16} color={Paleta.alerta} />
          <Text style={styles.textoAvisoSinDatos}>
            No hay entradas descargadas. Andá a Mi Fila y tocá Descargar entradas.
          </Text>
        </View>
      )}

      {resultado && <PanelResultado resultado={resultado} miNumeroDeFila={miNumeroDeFila} onValidar={validar} onCerrar={() => setResultado(null)} />}
    </View>
  );
}

function PanelResultado({
  resultado,
  miNumeroDeFila,
  onValidar,
  onCerrar,
}: {
  resultado: Resultado;
  miNumeroDeFila: number;
  onValidar: (ticket: TicketLocal) => void;
  onCerrar: () => void;
}) {
  const estilo = ESTILO_RESULTADO[resultado.tipo];

  return (
    <View style={styles.panelContenedor}>
      <View style={[styles.panel, { borderColor: estilo.color }]}>
        <View style={styles.panelEncabezado}>
          <Ionicons name={estilo.icono} size={26} color={estilo.color} />
          <Text style={[styles.panelTitulo, { color: estilo.color }]}>{estilo.titulo}</Text>
        </View>

        {resultado.tipo === 'inexistente' ? (
          <Text style={styles.panelTexto}>
            El código {resultado.codigo} no pertenece a este evento.
          </Text>
        ) : (
          <View style={styles.panelDetalle}>
            <Text style={styles.panelNombre}>
              {resultado.ticket.nombre_cliente ?? 'Sin nombre'}
            </Text>
            <Text style={styles.panelTexto}>
              {resultado.ticket.tipo_entrada ?? 'Entrada general'}
              {resultado.ticket.fila_asignada !== null &&
                `  ·  Fila ${resultado.ticket.fila_asignada}`}
            </Text>
            {resultado.tipo === 'usada' && resultado.ticket.usada_at && (
              <Text style={styles.panelTexto}>
                Utilizada el {new Date(resultado.ticket.usada_at).toLocaleString()}
              </Text>
            )}
            {resultado.tipo === 'otra_fila' && (
              <Text style={styles.panelTexto}>
                Corresponde a la fila {resultado.ticket.fila_asignada}, vos sos la{' '}
                {miNumeroDeFila}.
              </Text>
            )}
          </View>
        )}

        <View style={styles.panelAcciones}>
          {resultado.tipo === 'otra_fila' && (
            <Pressable
              accessibilityRole="button"
              onPress={() => onValidar(resultado.ticket)}
              style={[styles.botonPanel, { backgroundColor: Paleta.alerta }]}>
              <Text style={styles.textoBotonPanelOscuro}>Validar igual</Text>
            </Pressable>
          )}
          <Pressable accessibilityRole="button" onPress={onCerrar} style={styles.botonPanel}>
            <Text style={styles.textoBotonPanel}>Escanear siguiente</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: '#000000' },
  centrado: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.four,
    backgroundColor: Paleta.fondo,
  },
  textoPermiso: { color: Paleta.textoSuave, textAlign: 'center', fontSize: 15 },
  botonPrimario: {
    backgroundColor: Paleta.primario,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  textoBotonPrimario: { color: '#ffffff', fontWeight: '700' },
  guiaContenedor: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.four },
  guia: {
    width: 240,
    height: 240,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  guiaTexto: { color: '#ffffff', fontWeight: '600' },
  avisoSinDatos: {
    position: 'absolute',
    top: Spacing.three,
    left: Spacing.three,
    right: Spacing.three,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: 'rgba(9,9,11,0.92)',
    borderWidth: 1,
    borderColor: Paleta.alerta,
    borderRadius: 12,
    padding: Spacing.three,
  },
  textoAvisoSinDatos: { color: Paleta.texto, fontSize: 13, flex: 1 },
  panelContenedor: { flex: 1, justifyContent: 'flex-end', padding: Spacing.three },
  panel: {
    backgroundColor: Paleta.fondo,
    borderRadius: 20,
    borderWidth: 2,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  panelEncabezado: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  panelTitulo: { fontSize: 18, fontWeight: '800' },
  panelDetalle: { gap: Spacing.one },
  panelNombre: { color: Paleta.texto, fontSize: 16, fontWeight: '700' },
  panelTexto: { color: Paleta.textoSuave, fontSize: 14 },
  panelAcciones: { gap: Spacing.two },
  botonPanel: {
    backgroundColor: Paleta.superficieAlta,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  textoBotonPanel: { color: Paleta.texto, fontWeight: '700' },
  textoBotonPanelOscuro: { color: '#09090b', fontWeight: '800' },
});
