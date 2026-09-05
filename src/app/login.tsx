import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { MaxContentWidth, Paleta, Spacing } from '@/constants/theme';
import { API_BASE_URL } from '@/lib/config';
import { useAuthStore } from '@/store/auth';

export default function LoginScreen() {
  const iniciarSesion = useAuthStore((estado) => estado.iniciarSesion);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [verPassword, setVerPassword] = useState(false);

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
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        contentContainerStyle={styles.contenido}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}>
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
          <View style={styles.campoPassword}>
            <TextInput
              style={styles.inputPassword}
              placeholder="Contraseña"
              placeholderTextColor={Paleta.textoSuave}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!verPassword}
              value={password}
              onChangeText={setPassword}
              onSubmitEditing={enviar}
              editable={!enviando}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
              onPress={() => setVerPassword((visible) => !visible)}
              hitSlop={12}
              style={styles.ojo}>
              <Ionicons
                name={verPassword ? 'eye-off' : 'eye'}
                size={20}
                color={Paleta.textoSuave}
              />
            </Pressable>
          </View>

          {error && (
            <View style={styles.cajaError}>
              <Ionicons name="alert-circle" size={16} color={Paleta.error} />
              <View style={styles.flex}>
                <Text style={styles.textoError}>{error}</Text>
                <Text style={styles.textoDiagnostico}>
                  Servidor: {API_BASE_URL || '(sin configurar)'}
                </Text>
              </View>
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  raiz: { flex: 1, backgroundColor: Paleta.fondo },
  contenido: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.five,
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
  campoPassword: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Paleta.superficie,
    borderWidth: 1,
    borderColor: Paleta.borde,
    borderRadius: 14,
    paddingRight: Spacing.three,
  },
  inputPassword: {
    flex: 1,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
    color: Paleta.texto,
  },
  ojo: { padding: Spacing.one },
  flex: { flex: 1 },
  cajaError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
    paddingHorizontal: Spacing.one,
  },
  textoError: { color: Paleta.error, fontSize: 13 },
  textoDiagnostico: { color: Paleta.textoSuave, fontSize: 11, marginTop: 2 },
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
