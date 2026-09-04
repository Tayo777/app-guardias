import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MaxContentWidth, Paleta, Spacing } from '@/constants/theme';
import { useAuthStore } from '@/store/auth';

export default function LoginScreen() {
  const iniciarSesion = useAuthStore((estado) => estado.iniciarSesion);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  const puedeEnviar = email.trim().length > 0 && password.length > 0 && !enviando;

  async function enviar() {
    if (!puedeEnviar) return;
    setError(null);
    setEnviando(true);
    try {
      await iniciarSesion(email.trim(), password);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo iniciar sesion');
      setEnviando(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.raiz}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.contenido}>
        <View style={styles.marca}>
          <View style={styles.logo}>
            <Ionicons name="shield-checkmark" size={28} color={Paleta.texto} />
          </View>
          <Text style={styles.titulo}>Control de Acceso</Text>
          <Text style={styles.subtitulo}>Ingresá con tu cuenta de guardia</Text>
        </View>

        <View style={styles.formulario}>
          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={Paleta.textoSuave}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
            editable={!enviando}
          />
          <TextInput
            style={styles.input}
            placeholder="Contraseña"
            placeholderTextColor={Paleta.textoSuave}
            autoCapitalize="none"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            onSubmitEditing={enviar}
            editable={!enviando}
          />

          {error && (
            <View style={styles.cajaError}>
              <Ionicons name="alert-circle" size={16} color={Paleta.error} />
              <Text style={styles.textoError}>{error}</Text>
            </View>
          )}

          <Pressable
            accessibilityRole="button"
            disabled={!puedeEnviar}
            onPress={enviar}
            style={({ pressed }) => [
              styles.boton,
              { opacity: !puedeEnviar ? 0.4 : pressed ? 0.85 : 1 },
            ]}>
            {enviando ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.textoBoton}>Ingresar</Text>
            )}
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Paleta.fondo },
  contenido: {
    flex: 1,
    justifyContent: 'center',
    gap: Spacing.six,
    paddingHorizontal: Spacing.four,
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
  },
  marca: { alignItems: 'center', gap: Spacing.two },
  logo: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.two,
  },
  titulo: { color: Paleta.texto, fontSize: 26, fontWeight: '700' },
  subtitulo: { color: Paleta.textoSuave, fontSize: 14 },
  formulario: { gap: Spacing.three },
  input: {
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Paleta.texto,
  },
  cajaError: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  textoError: { color: Paleta.error, fontSize: 13, flex: 1 },
  boton: {
    backgroundColor: Paleta.primario,
    borderRadius: 14,
    paddingVertical: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    marginTop: Spacing.two,
  },
  textoBoton: { color: '#ffffff', fontSize: 16, fontWeight: '700' },
});
