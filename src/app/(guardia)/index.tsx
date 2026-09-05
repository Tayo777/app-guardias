import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Paleta, Spacing } from '@/constants/theme';
import { buscarTicketPorId, contarTickets, marcarTicketUsado } from '@/lib/db';
import { leerQr, type LecturaQr } from '@/lib/qr';
import type { TicketLocal } from '@/lib/types';
import { useAuthStore } from '@/store/auth';

type Resultado =
  | { tipo: 'permitido'; ticket: TicketLocal }
  | { tipo: 'ya_escaneada'; ticket: TicketLocal }
  | { tipo: 'otra_fila'; ticket: TicketLocal }
  | { tipo: 'inexistente'; codigo: string }
  | (Extract<LecturaQr, { valido: false }> & { tipo: 'invalido' });

export default function EscanerScreen() {
  const db = useSQLiteContext();
  const miNumeroDeFila = useAuthStore((estado) => estado.miNumeroDeFila) ?? 0;
  const qrSecret = useAuthStore((estado) => estado.qrSecret);

  const [permiso, pedirPermiso] = useCameraPermissions();
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [enfocado, setEnfocado] = useState(false);
  const [sinEntradas, setSinEntradas] = useState(false);
  const [linterna, setLinterna] = useState(false);
  const [manualAbierto, setManualAbierto] = useState(false);
  const [codigoManual, setCodigoManual] = useState('');

  useFocusEffect(
    useCallback(() => {
      setEnfocado(true);
      contarTickets(db).then((cantidad) => setSinEntradas(cantidad === 0));
      return () => {
        setEnfocado(false);
        setLinterna(false);
      };
    }, [db])
  );

  const procesarId = useCallback(
    async (id: string) => {
      const ticket = await buscarTicketPorId(db, id);

      if (!ticket) {
        setResultado({ tipo: 'inexistente', codigo: id });
        return;
      }

      // Regla de particion: si no es de esta fila se bloquea y NO se toca la entrada.
      if (ticket.fila_asignada !== null && ticket.fila_asignada !== miNumeroDeFila) {
        setResultado({ tipo: 'otra_fila', ticket });
        return;
      }

      if (ticket.estado === 'USADA' || ticket.usada_at !== null) {
        setResultado({ tipo: 'ya_escaneada', ticket });
        return;
      }

      const marcado = await marcarTicketUsado(db, ticket.id);
      const actualizado = (await buscarTicketPorId(db, ticket.id)) ?? ticket;
      setResultado({ tipo: marcado ? 'permitido' : 'ya_escaneada', ticket: actualizado });
    },
    [db, miNumeroDeFila]
  );

  async function alEscanear(dato: string) {
    if (procesando || resultado) return;
    setProcesando(true);
    try {
      const lectura = leerQr(dato, qrSecret);
      if (!lectura.valido) {
        setResultado({ ...lectura, tipo: 'invalido' });
        return;
      }
      await procesarId(lectura.id);
    } finally {
      setProcesando(false);
    }
  }

  async function validarManual() {
    const id = codigoManual.trim();
    if (!id || procesando) return;
    setProcesando(true);
    setManualAbierto(false);
    setCodigoManual('');
    try {
      await procesarId(id);
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
          enableTorch={linterna}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={resultado ? undefined : ({ data }) => alEscanear(data)}
        />
      )}

      {!resultado && (
        <>
          <View style={styles.guiaContenedor} pointerEvents="none">
            <View style={styles.guia} />
            <Text style={styles.guiaTexto}>Apuntá al QR de la entrada</Text>
          </View>

          {sinEntradas && (
            <View style={styles.avisoSinDatos}>
              <Ionicons name="cloud-download-outline" size={16} color={Paleta.alerta} />
              <Text style={styles.textoAvisoSinDatos}>
                No hay entradas descargadas. Andá a Mi Fila y tocá Sincronizar.
              </Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={linterna ? 'Apagar linterna' : 'Encender linterna'}
            onPress={() => setLinterna((prendida) => !prendida)}
            style={[styles.botonFlotante, styles.botonLinterna, linterna && styles.linternaActiva]}>
            <Ionicons
              name={linterna ? 'flashlight' : 'flashlight-outline'}
              size={24}
              color={linterna ? '#09090b' : '#ffffff'}
            />
          </Pressable>

          <Pressable
            accessibilityRole="button"
            onPress={() => setManualAbierto(true)}
            style={[styles.botonFlotante, styles.botonManual]}>
            <Ionicons name="keypad" size={22} color="#ffffff" />
            <Text style={styles.textoBotonManual}>Cargar código</Text>
          </Pressable>
        </>
      )}

      {resultado && (
        <PantallaResultado
          resultado={resultado}
          miNumeroDeFila={miNumeroDeFila}
          onCerrar={() => setResultado(null)}
        />
      )}

      <Modal
        visible={manualAbierto}
        transparent
        animationType="fade"
        onRequestClose={() => setManualAbierto(false)}>
        <View style={styles.fondoModal}>
          <View style={styles.tarjetaModal}>
            <Text style={styles.tituloModal}>Cargar código manualmente</Text>
            <Text style={styles.subtituloModal}>
              Usalo solo si la cámara falla. La carga manual no valida la firma del QR.
            </Text>
            <TextInput
              style={styles.inputModal}
              placeholder="Ej: A1B2C3D4"
              placeholderTextColor={Paleta.textoSuave}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              value={codigoManual}
              onChangeText={setCodigoManual}
              onSubmitEditing={validarManual}
            />
            <View style={styles.accionesModal}>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setManualAbierto(false);
                  setCodigoManual('');
                }}
                style={[styles.botonModal, { backgroundColor: Paleta.superficieAlta }]}>
                <Text style={styles.textoBotonModal}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={validarManual}
                style={[styles.botonModal, { backgroundColor: Paleta.primario }]}>
                <Text style={styles.textoBotonModal}>Validar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * Cada motivo de invalidez tiene severidad distinta: "firma" es sospecha real
 * de fraude, "sin_secreto" es un problema de configuracion de la sesion, y
 * "formato" suele ser un QR viejo o de otro sistema. Mostrarlos todos como
 * "QR FALSO" confunde al guardia y esconde el problema real (esto fue un bug).
 */
const CONTENIDO_INVALIDO = {
  formato: {
    fondo: '#78350f',
    icono: 'help-circle-outline' as const,
    titulo: 'QR NO RECONOCIDO',
  },
  sin_secreto: {
    fondo: '#1e3a8a',
    icono: 'key-outline' as const,
    titulo: 'FALTA CONFIGURACIÓN',
  },
  firma: {
    fondo: '#7f1d1d',
    icono: 'alert-circle' as const,
    titulo: 'QR FALSO O ADULTERADO',
  },
};

function PantallaResultado({
  resultado,
  miNumeroDeFila,
  onCerrar,
}: {
  resultado: Resultado;
  miNumeroDeFila: number;
  onCerrar: () => void;
}) {
  const contenido =
    resultado.tipo === 'invalido'
      ? CONTENIDO_INVALIDO[resultado.motivo]
      : {
          permitido: {
            fondo: '#15803d',
            icono: 'checkmark-circle' as const,
            titulo: 'ACCESO PERMITIDO',
          },
          ya_escaneada: {
            fondo: '#b91c1c',
            icono: 'close-circle' as const,
            titulo: 'ENTRADA YA ESCANEADA',
          },
          otra_fila: {
            fondo: '#c2410c',
            icono: 'swap-horizontal' as const,
            titulo: 'PERTENECE A OTRA FILA',
          },
          inexistente: {
            fondo: '#b91c1c',
            icono: 'help-circle' as const,
            titulo: 'ENTRADA INEXISTENTE',
          },
        }[resultado.tipo];

  return (
    <View style={[styles.overlay, { backgroundColor: contenido.fondo }]}>
      <View style={styles.overlayCentro}>
        <Ionicons name={contenido.icono} size={92} color="#ffffff" />
        <Text style={styles.overlayTitulo}>{contenido.titulo}</Text>

        {resultado.tipo === 'permitido' && (
          <View style={styles.overlayDetalle}>
            <Text style={styles.overlayTipo}>{resultado.ticket.tipo ?? 'Entrada general'}</Text>
            <Text style={styles.overlayNombre}>
              {resultado.ticket.nombre_comprador ?? 'Sin nombre'}
            </Text>
          </View>
        )}

        {resultado.tipo === 'ya_escaneada' && (
          <View style={styles.overlayDetalle}>
            <Text style={styles.overlaySubtitulo}>RECHAZAR</Text>
            <Text style={styles.overlayNombre}>
              {resultado.ticket.nombre_comprador ?? 'Sin nombre'}
            </Text>
            {resultado.ticket.usada_at && (
              <Text style={styles.overlayTexto}>
                Escaneada el {new Date(resultado.ticket.usada_at).toLocaleString()}
              </Text>
            )}
          </View>
        )}

        {resultado.tipo === 'otra_fila' && (
          <View style={styles.overlayDetalle}>
            <Text style={styles.overlayTexto}>Dirigir a</Text>
            <View style={styles.insigniaFila}>
              <Text style={styles.textoInsigniaFila}>FILA {resultado.ticket.fila_asignada}</Text>
            </View>
            <Text style={styles.overlayTexto}>Vos estás cubriendo la fila {miNumeroDeFila}</Text>
          </View>
        )}

        {resultado.tipo === 'invalido' && (
          <View style={styles.overlayDetalle}>
            {resultado.motivo === 'sin_secreto' && (
              <Text style={styles.overlayTexto}>
                La sesión no tiene el secreto del evento. Cerrá sesión y volvé a ingresar.
              </Text>
            )}
            {resultado.motivo === 'formato' && (
              <Text style={styles.overlayTexto}>
                El QR no tiene el formato esperado (¿es de otro sistema o de un evento viejo?).
              </Text>
            )}
            {resultado.motivo === 'firma' && (
              <Text style={styles.overlayTexto}>
                El código no coincide con la firma del evento.
              </Text>
            )}
            <PanelTecnico resultado={resultado} />
          </View>
        )}

        {resultado.tipo === 'inexistente' && (
          <Text style={styles.overlayTexto}>
            El código {resultado.codigo} no pertenece a este evento.
          </Text>
        )}
      </View>

      <Pressable accessibilityRole="button" onPress={onCerrar} style={styles.botonSiguiente}>
        <Text style={styles.textoBotonSiguiente}>Escanear siguiente</Text>
      </Pressable>
    </View>
  );
}

/**
 * Detalle tecnico para diagnosticar el desajuste con el backend sin exponer el
 * secreto: id leido, y para "firma" ambos hashes completos (Hex-SHA256) para
 * compararlos caracter a caracter con lo que firma el backend.
 */
function PanelTecnico({ resultado }: { resultado: Extract<Resultado, { tipo: 'invalido' }> }) {
  const [abierto, setAbierto] = useState(false);

  return (
    <View style={styles.panelTecnico}>
      <Pressable accessibilityRole="button" onPress={() => setAbierto((v) => !v)}>
        <Text style={styles.textoPanelTecnicoToggle}>
          {abierto ? 'Ocultar detalle técnico ▲' : 'Ver detalle técnico ▼'}
        </Text>
      </Pressable>

      {abierto && (
        <View style={styles.panelTecnicoContenido}>
          {resultado.motivo === 'formato' && (
            <FilaTecnica etiqueta="Contenido crudo del QR" valor={resultado.crudo} />
          )}
          {resultado.motivo === 'sin_secreto' && (
            <FilaTecnica etiqueta="id leído" valor={resultado.id} />
          )}
          {resultado.motivo === 'firma' && (
            <>
              <FilaTecnica etiqueta="id leído" valor={resultado.id} />
              <FilaTecnica etiqueta="firma del QR" valor={resultado.firmaRecibida} />
              <Text style={styles.etiquetaTecnica}>Candidatos probados (ninguno coincidió)</Text>
              {resultado.candidatos.map((c) => (
                <FilaTecnica key={c.etiqueta} etiqueta={c.etiqueta} valor={c.valor} />
              ))}
            </>
          )}
        </View>
      )}
    </View>
  );
}

function FilaTecnica({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <View style={styles.filaTecnica}>
      <Text style={styles.etiquetaTecnica}>{etiqueta}</Text>
      <Text style={styles.valorTecnico} selectable>
        {valor || '(vacío)'}
      </Text>
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
    right: 72,
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

  botonFlotante: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(9,9,11,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  botonLinterna: { top: Spacing.three, right: Spacing.three, width: 52, height: 52, borderRadius: 26 },
  linternaActiva: { backgroundColor: '#facc15', borderColor: '#facc15' },
  botonManual: {
    flexDirection: 'row',
    gap: Spacing.two,
    bottom: Spacing.four,
    right: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: 28,
  },
  textoBotonManual: { color: '#ffffff', fontWeight: '700' },

  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    padding: Spacing.four,
    justifyContent: 'space-between',
  },
  overlayCentro: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.three },
  overlayTitulo: {
    color: '#ffffff',
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '900',
    textAlign: 'center',
  },
  overlayDetalle: { alignItems: 'center', gap: Spacing.two },
  overlaySubtitulo: { color: '#ffffff', fontSize: 24, fontWeight: '900', letterSpacing: 2 },
  overlayTipo: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  overlayNombre: { color: '#ffffff', fontSize: 26, fontWeight: '700', textAlign: 'center' },
  overlayTexto: { color: 'rgba(255,255,255,0.9)', fontSize: 16, textAlign: 'center' },
  insigniaFila: {
    backgroundColor: '#1d4ed8',
    borderRadius: 18,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  textoInsigniaFila: { color: '#ffffff', fontSize: 40, fontWeight: '900', letterSpacing: 2 },
  botonSiguiente: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 16,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  textoBotonSiguiente: { color: '#ffffff', fontSize: 17, fontWeight: '800' },
  panelTecnico: { marginTop: Spacing.two, alignItems: 'center' },
  textoPanelTecnicoToggle: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    textDecorationLine: 'underline',
  },
  panelTecnicoContenido: {
    marginTop: Spacing.two,
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: 12,
    padding: Spacing.three,
    gap: Spacing.two,
    width: '100%',
  },
  filaTecnica: { gap: 2 },
  etiquetaTecnica: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  valorTecnico: { color: '#ffffff', fontSize: 13, fontFamily: 'monospace' },

  fondoModal: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: Spacing.four,
  },
  tarjetaModal: {
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 20,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  tituloModal: { color: Paleta.texto, fontSize: 18, fontWeight: '800' },
  subtituloModal: { color: Paleta.textoSuave, fontSize: 13 },
  inputModal: {
    backgroundColor: Paleta.fondo,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 18,
    letterSpacing: 2,
    color: Paleta.texto,
  },
  accionesModal: { flexDirection: 'row', gap: Spacing.two },
  botonModal: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  textoBotonModal: { color: '#ffffff', fontWeight: '700' },
});
