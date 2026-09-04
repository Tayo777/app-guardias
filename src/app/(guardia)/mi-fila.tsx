import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MaxContentWidth, Paleta, Spacing } from '@/constants/theme';
import { buscarTicketsDeFila, obtenerResumen, type Resumen } from '@/lib/db';
import { descargarEntradas, subirEscaneos } from '@/lib/sync';
import type { TicketLocal } from '@/lib/types';
import { useAuthStore } from '@/store/auth';

export default function MiFilaScreen() {
  const db = useSQLiteContext();
  const token = useAuthStore((estado) => estado.token);
  const email = useAuthStore((estado) => estado.email);
  const eventoNombre = useAuthStore((estado) => estado.eventoNombre);
  const miNumeroDeFila = useAuthStore((estado) => estado.miNumeroDeFila) ?? 0;
  const cerrarSesion = useAuthStore((estado) => estado.cerrarSesion);

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [tickets, setTickets] = useState<TicketLocal[]>([]);
  const [busqueda, setBusqueda] = useState('');
  const [ocupado, setOcupado] = useState<'descarga' | 'subida' | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  const cargar = useCallback(async () => {
    setResumen(await obtenerResumen(db, miNumeroDeFila));
    setTickets(await buscarTicketsDeFila(db, miNumeroDeFila, busqueda));
  }, [db, miNumeroDeFila, busqueda]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar])
  );

  async function sincronizar(accion: 'descarga' | 'subida') {
    if (!token || ocupado) return;
    setOcupado(accion);
    setAviso(null);
    try {
      if (accion === 'descarga') {
        const cantidad = await descargarEntradas(db, token);
        setAviso({ texto: `${cantidad} entradas descargadas`, error: false });
      } else {
        const cantidad = await subirEscaneos(db, token);
        setAviso({
          texto: cantidad === 0 ? 'No había escaneos pendientes' : `${cantidad} escaneos subidos`,
          error: false,
        });
      }
      await cargar();
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'Falló la sincronización', error: true });
    } finally {
      setOcupado(null);
    }
  }

  const encabezado = (
    <View style={styles.encabezadoLista}>
      <View style={styles.encabezado}>
        <View style={styles.flex}>
          <Text style={styles.etiquetaFila}>MI FILA</Text>
          <Text style={styles.numeroFila}>{miNumeroDeFila}</Text>
          <Text style={styles.subtitulo}>{email}</Text>
          {eventoNombre && <Text style={styles.subtitulo}>{eventoNombre}</Text>}
        </View>
        <Pressable accessibilityRole="button" onPress={cerrarSesion} style={styles.botonSalir}>
          <Ionicons name="log-out-outline" size={20} color={Paleta.textoSuave} />
        </Pressable>
      </View>

      <View style={styles.tarjeta}>
        <Dato
          etiqueta="Entradas de mi fila"
          valor={`${resumen?.mi_fila_usadas ?? 0} / ${resumen?.mi_fila_total ?? 0}`}
        />
        <Dato etiqueta="Entradas del evento" valor={resumen?.total ?? 0} />
        <Dato
          etiqueta="Escaneos sin subir"
          valor={resumen?.pendientes ?? 0}
          resaltado={(resumen?.pendientes ?? 0) > 0}
        />
      </View>

      <View style={styles.acciones}>
        <BotonAccion
          icono="cloud-download-outline"
          texto="Sincronizar entradas"
          cargando={ocupado === 'descarga'}
          deshabilitado={ocupado !== null}
          onPress={() => sincronizar('descarga')}
        />
        <BotonAccion
          icono="cloud-upload-outline"
          texto={resumen?.pendientes ? `Subir escaneos (${resumen.pendientes})` : 'Subir escaneos'}
          cargando={ocupado === 'subida'}
          deshabilitado={ocupado !== null}
          onPress={() => sincronizar('subida')}
        />
      </View>

      {aviso && (
        <Text style={[styles.aviso, { color: aviso.error ? Paleta.error : Paleta.exito }]}>
          {aviso.texto}
        </Text>
      )}

      <View style={styles.buscador}>
        <Ionicons name="search" size={18} color={Paleta.textoSuave} />
        <TextInput
          style={styles.inputBuscador}
          placeholder="Buscar por nombre o N° de entrada"
          placeholderTextColor={Paleta.textoSuave}
          autoCapitalize="none"
          autoCorrect={false}
          value={busqueda}
          onChangeText={setBusqueda}
        />
        {busqueda.length > 0 && (
          <Pressable accessibilityRole="button" onPress={() => setBusqueda('')}>
            <Ionicons name="close-circle" size={18} color={Paleta.textoSuave} />
          </Pressable>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      style={styles.raiz}
      contentContainerStyle={styles.contenido}
      data={tickets}
      keyExtractor={(item) => String(item.id)}
      ListHeaderComponent={encabezado}
      keyboardShouldPersistTaps="handled"
      renderItem={({ item }) => <FilaTicket ticket={item} />}
      ListEmptyComponent={
        <Text style={styles.vacio}>
          {busqueda
            ? 'Sin resultados para esa búsqueda.'
            : 'No hay entradas asignadas a tu fila. Probá sincronizar.'}
        </Text>
      }
    />
  );
}

function FilaTicket({ ticket }: { ticket: TicketLocal }) {
  const usada = ticket.estado === 'USADA';

  return (
    <View style={styles.item}>
      <View style={styles.flex}>
        <Text style={styles.itemNombre}>{ticket.nombre_comprador ?? 'Sin nombre'}</Text>
        <Text style={styles.itemDetalle}>
          #{ticket.id}
          {ticket.tipo ? `  ·  ${ticket.tipo}` : ''}
        </Text>
      </View>

      {ticket.pendiente_sync === 1 && (
        <Ionicons name="cloud-offline-outline" size={16} color={Paleta.alerta} />
      )}
      <View style={[styles.insignia, { backgroundColor: usada ? '#14532d' : Paleta.superficieAlta }]}>
        <Text style={[styles.textoInsignia, { color: usada ? '#86efac' : Paleta.textoSuave }]}>
          {usada ? 'USADA' : 'VÁLIDA'}
        </Text>
      </View>
    </View>
  );
}

function Dato({
  etiqueta,
  valor,
  resaltado = false,
}: {
  etiqueta: string;
  valor: number | string;
  resaltado?: boolean;
}) {
  return (
    <View style={styles.dato}>
      <Text style={styles.datoEtiqueta}>{etiqueta}</Text>
      <Text style={[styles.datoValor, resaltado && { color: Paleta.alerta }]}>{valor}</Text>
    </View>
  );
}

function BotonAccion({
  icono,
  texto,
  cargando,
  deshabilitado,
  onPress,
}: {
  icono: 'cloud-download-outline' | 'cloud-upload-outline';
  texto: string;
  cargando: boolean;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={onPress}
      style={({ pressed }) => [
        styles.botonAccion,
        { opacity: deshabilitado ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      {cargando ? (
        <ActivityIndicator color={Paleta.texto} />
      ) : (
        <>
          <Ionicons name={icono} size={18} color={Paleta.texto} />
          <Text style={styles.textoBotonAccion}>{texto}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Paleta.fondo },
  flex: { flex: 1 },
  contenido: {
    padding: Spacing.four,
    paddingTop: Spacing.three,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  encabezadoLista: { gap: Spacing.three, marginBottom: Spacing.three },
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  etiquetaFila: { color: Paleta.textoSuave, fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  numeroFila: { color: Paleta.texto, fontSize: 56, fontWeight: '800', lineHeight: 62 },
  subtitulo: { color: Paleta.textoSuave, fontSize: 14 },
  botonSalir: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tarjeta: {
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 18,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  dato: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  datoEtiqueta: { color: Paleta.textoSuave, fontSize: 14, flex: 1 },
  datoValor: { color: Paleta.texto, fontSize: 15, fontWeight: '700' },
  acciones: { gap: Spacing.two },
  botonAccion: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: Paleta.superficieAlta,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  textoBotonAccion: { color: Paleta.texto, fontWeight: '700', fontSize: 15 },
  aviso: { fontSize: 14 },
  buscador: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
  },
  inputBuscador: { flex: 1, color: Paleta.texto, fontSize: 15, paddingVertical: Spacing.three },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Paleta.borde,
  },
  itemNombre: { color: Paleta.texto, fontSize: 15, fontWeight: '600' },
  itemDetalle: { color: Paleta.textoSuave, fontSize: 13, marginTop: 2 },
  insignia: { borderRadius: 8, paddingHorizontal: Spacing.two, paddingVertical: Spacing.one },
  textoInsignia: { fontSize: 11, fontWeight: '800' },
  vacio: { color: Paleta.textoSuave, fontSize: 14, textAlign: 'center', paddingVertical: Spacing.four },
});
