import { Link, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { obtenerResumen, type Resumen } from '@/lib/db';
import { useSesion } from '@/lib/session';
import { descargarEntradas, subirEscaneos } from '@/lib/sync';

export default function PanelScreen() {
  const theme = useTheme();
  const db = useSQLiteContext();
  const { sesion, cerrarSesion } = useSesion();
  const fila = sesion?.guardia.fila_asignada ?? 0;

  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [ocupado, setOcupado] = useState<'descarga' | 'subida' | null>(null);
  const [aviso, setAviso] = useState<{ texto: string; error: boolean } | null>(null);

  const refrescar = useCallback(async () => {
    setResumen(await obtenerResumen(db, fila));
  }, [db, fila]);

  useFocusEffect(
    useCallback(() => {
      refrescar();
    }, [refrescar])
  );

  async function sincronizar(accion: 'descarga' | 'subida') {
    if (!sesion || ocupado) return;
    setOcupado(accion);
    setAviso(null);
    try {
      if (accion === 'descarga') {
        const cantidad = await descargarEntradas(db, sesion.token);
        setAviso({ texto: `${cantidad} entradas descargadas`, error: false });
      } else {
        const cantidad = await subirEscaneos(db, sesion.token);
        setAviso({
          texto: cantidad === 0 ? 'No habia escaneos pendientes' : `${cantidad} escaneos subidos`,
          error: false,
        });
      }
      await refrescar();
    } catch (e) {
      setAviso({ texto: e instanceof Error ? e.message : 'Fallo la sincronizacion', error: true });
    } finally {
      setOcupado(null);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.contenido}>
          <ThemedView style={styles.encabezado}>
            <ThemedView style={styles.flex}>
              <ThemedText type="subtitle">Fila {fila}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {sesion?.guardia.nombre ?? sesion?.guardia.email}
              </ThemedText>
            </ThemedView>
            <Pressable accessibilityRole="button" onPress={cerrarSesion}>
              <ThemedText type="small" themeColor="textSecondary">
                Salir
              </ThemedText>
            </Pressable>
          </ThemedView>

          <Link href="/escaner" asChild>
            <Pressable accessibilityRole="button" style={styles.botonPrincipal}>
              <ThemedText type="smallBold" style={styles.botonPrincipalTexto}>
                Escanear entrada
              </ThemedText>
            </Pressable>
          </Link>

          <ThemedView type="backgroundElement" style={styles.tarjeta}>
            <Dato etiqueta="Entradas del evento" valor={resumen?.total ?? 0} />
            <Dato etiqueta="Ya utilizadas" valor={resumen?.usadas ?? 0} />
            <Dato
              etiqueta={`Asignadas a mi fila (${fila})`}
              valor={`${resumen?.mi_fila_usadas ?? 0} / ${resumen?.mi_fila_total ?? 0}`}
            />
            <Dato etiqueta="Escaneos sin subir" valor={resumen?.pendientes ?? 0} />
          </ThemedView>

          <ThemedView style={styles.acciones}>
            <BotonSecundario
              texto="Descargar entradas"
              cargando={ocupado === 'descarga'}
              deshabilitado={ocupado !== null}
              onPress={() => sincronizar('descarga')}
            />
            <BotonSecundario
              texto={
                resumen?.pendientes
                  ? `Subir escaneos (${resumen.pendientes})`
                  : 'Subir escaneos'
              }
              cargando={ocupado === 'subida'}
              deshabilitado={ocupado !== null}
              onPress={() => sincronizar('subida')}
            />
          </ThemedView>

          {aviso && (
            <ThemedText
              type="small"
              style={{ color: aviso.error ? '#dc2626' : theme.textSecondary }}>
              {aviso.texto}
            </ThemedText>
          )}

          {resumen?.ultima_descarga && (
            <ThemedText type="small" themeColor="textSecondary">
              Ultima descarga: {new Date(resumen.ultima_descarga).toLocaleString()}
            </ThemedText>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: number | string }) {
  return (
    <ThemedView type="backgroundElement" style={styles.dato}>
      <ThemedText type="small" themeColor="textSecondary" style={styles.flex}>
        {etiqueta}
      </ThemedText>
      <ThemedText type="smallBold">{valor}</ThemedText>
    </ThemedView>
  );
}

function BotonSecundario({
  texto,
  cargando,
  deshabilitado,
  onPress,
}: {
  texto: string;
  cargando: boolean;
  deshabilitado: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={deshabilitado}
      onPress={onPress}
      style={[
        styles.botonSecundario,
        { backgroundColor: theme.backgroundSelected, opacity: deshabilitado ? 0.5 : 1 },
      ]}>
      {cargando ? <ActivityIndicator color={theme.text} /> : <ThemedText type="small">{texto}</ThemedText>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  safeArea: { flex: 1 },
  contenido: {
    gap: Spacing.four,
    padding: Spacing.four,
    maxWidth: MaxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  encabezado: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.three },
  botonPrincipal: {
    backgroundColor: '#208AEF',
    borderRadius: Spacing.three,
    paddingVertical: Spacing.four,
    alignItems: 'center',
  },
  botonPrincipalTexto: { color: '#ffffff', fontSize: 16 },
  tarjeta: { borderRadius: Spacing.three, padding: Spacing.three, gap: Spacing.two },
  dato: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  acciones: { gap: Spacing.two },
  botonSecundario: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
});
