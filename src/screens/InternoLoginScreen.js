import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { MOCK_USERS } from '../data/mockUsers';

// Lista apenas usuários internos (fiscais/supervisores), ordenados por sigla
const INTERNOS = Object.values(MOCK_USERS)
  .filter(u => u.role === 'interno' && u.sigla)
  .sort((a, b) => a.sigla.localeCompare(b.sigla));

export default function InternoLoginScreen({ navigation }) {
  const { login } = useAuth();
  const [selectedSigla, setSelectedSigla] = useState(null);
  const [password, setPassword]           = useState('1234');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);

  async function handleLogin() {
    if (!selectedSigla || !password.trim()) {
      Alert.alert('Atenção', 'Selecione seu usuário e informe a senha.');
      return;
    }
    setLoading(true);
    const success = await login(selectedSigla, password.trim());
    setLoading(false);
    if (!success) Alert.alert('Erro', 'Usuário ou senha incorretos.');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>

        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>SIgo</Text>
          <Text style={styles.logoSub}>Acesso Interno</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Entrar — Interno</Text>

          {/* Chips de usuário interno — clicando na mesma sigla deseleciona */}
          <Text style={styles.label}>Selecione seu usuário</Text>
          <View style={styles.chipsWrap}>
            {INTERNOS.map(u => (
              <TouchableOpacity
                key={u.sigla}
                style={[styles.siglaChip, selectedSigla === u.sigla && styles.chipActive]}
                onPress={() => setSelectedSigla(v => v === u.sigla ? null : u.sigla)}
                activeOpacity={0.7}
              >
                <Text style={[styles.siglaCod, selectedSigla === u.sigla && styles.siglaCodActive]}>
                  {u.sigla}
                </Text>
                <Text style={[styles.siglaNome, selectedSigla === u.sigla && styles.siglaNomeActive]}>
                  {u.nome}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Senha</Text>
          <View style={styles.passwordWrapper}>
            <TextInput
              style={styles.passwordInput}
              placeholder="Digite a senha"
              placeholderTextColor="#9CA3AF"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn}>
              <Text style={styles.eyeText}>{showPassword ? '🙈' : '👁️'}</Text>
            </TouchableOpacity>
          </View>

          {/* Botão só ativa quando sigla e senha estiverem preenchidos */}
          <TouchableOpacity
            style={[styles.button, (!selectedSigla || loading) && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={!selectedSigla || loading}
            activeOpacity={0.8}
          >
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={styles.buttonText}>Entrar</Text>
            }
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1E3A5F' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: '#93C5FD', fontSize: 14, fontWeight: '600' },
  logoContainer: { alignItems: 'center', marginBottom: 36 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },
  logoSub: { fontSize: 13, color: '#93C5FD', marginTop: 4, letterSpacing: 1 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A5F', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  siglaChip: {
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
    alignItems: 'center', minWidth: 100,
  },
  chipActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  siglaCod: { fontSize: 12, fontWeight: '800', color: '#1E3A5F' },
  siglaCodActive: { color: '#FFFFFF' },
  siglaNome: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  siglaNomeActive: { color: '#93C5FD' },
  passwordWrapper: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10, backgroundColor: '#F9FAFB',
  },
  passwordInput: {
    flex: 1, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, color: '#111827',
  },
  eyeBtn: { paddingHorizontal: 12 },
  eyeText: { fontSize: 18 },
  button: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
