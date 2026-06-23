import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_USERS } from '../data/mockUsers';

// Lista apenas usuários internos (colaboradores EDP), ordenados por nome
const INTERNOS = Object.values(MOCK_USERS)
  .filter(u => u.role === 'interno' && u.sigla)
  .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));

export default function InternoLoginScreen({ navigation }) {
  const { login } = useAuth();
  const [selectedSigla, setSelectedSigla] = useState(null);
  const [busca, setBusca]                 = useState('');
  const [password, setPassword]           = useState('1234');
  const [showPassword, setShowPassword]   = useState(false);
  const [loading, setLoading]             = useState(false);

  // Filtra a lista por sigla ou nome digitado
  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return INTERNOS;
    return INTERNOS.filter(
      u => u.sigla.toLowerCase().includes(q) || u.nome.toLowerCase().includes(q)
    );
  }, [busca]);

  const selecionado = selectedSigla ? MOCK_USERS[selectedSigla] : null;

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

          <Text style={styles.label}>Selecione seu usuário</Text>

          {/* Quando há um selecionado, mostra um resumo enxuto com opção de trocar */}
          {selecionado ? (
            <View style={styles.selectedRow}>
              <View style={styles.siglaBadgeActive}>
                <Text style={styles.siglaBadgeTextActive}>{selecionado.sigla}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.selectedNome} numberOfLines={1}>{selecionado.nome}</Text>
                <Text style={styles.selectedHint}>Toque em trocar para mudar</Text>
              </View>
              <TouchableOpacity onPress={() => setSelectedSigla(null)} style={styles.trocarBtn} activeOpacity={0.7}>
                <Text style={styles.trocarText}>Trocar</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {/* Busca para encontrar o usuário rapidamente */}
              <View style={styles.searchWrapper}>
                <Feather name="search" size={16} color="#9CA3AF" />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Buscar por sigla ou nome"
                  placeholderTextColor="#9CA3AF"
                  value={busca}
                  onChangeText={setBusca}
                />
              </View>

              {/* Lista vertical de largura uniforme — fácil de tocar no celular */}
              <ScrollView
                style={styles.userList}
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {lista.length === 0 ? (
                  <Text style={styles.empty}>Nenhum usuário encontrado.</Text>
                ) : (
                  lista.map((u, idx) => (
                    <TouchableOpacity
                      key={u.sigla}
                      style={[styles.userRow, idx === lista.length - 1 && { borderBottomWidth: 0 }]}
                      onPress={() => { setSelectedSigla(u.sigla); setBusca(''); }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.siglaBadge}>
                        <Text style={styles.siglaBadgeText}>{u.sigla}</Text>
                      </View>
                      <Text style={styles.userNome} numberOfLines={1}>{u.nome}</Text>
                      <Feather name="chevron-right" size={18} color="#CBD5E1" />
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </>
          )}

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
  logoContainer: { alignItems: 'center', marginBottom: 32 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },
  logoSub: { fontSize: 13, color: '#93C5FD', marginTop: 4, letterSpacing: 1 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A5F', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 18 },

  // Busca
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#F9FAFB', paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#111827' },

  // Lista de usuários
  userList: {
    maxHeight: 260, marginTop: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12,
    backgroundColor: '#FFFFFF',
  },
  userRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 12,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  userNome: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1F2937' },
  empty: { fontSize: 13, color: '#9CA3AF', textAlign: 'center', paddingVertical: 24 },

  siglaBadge: {
    backgroundColor: '#EFF2F7', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, minWidth: 70, alignItems: 'center',
  },
  siglaBadgeText: { fontSize: 12, fontWeight: '800', color: '#1E3A5F' },

  // Resumo do selecionado
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderWidth: 1.5, borderColor: '#1E3A5F', borderRadius: 12,
    backgroundColor: '#EFF6FF', padding: 12,
  },
  siglaBadgeActive: {
    backgroundColor: '#1E3A5F', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, minWidth: 70, alignItems: 'center',
  },
  siglaBadgeTextActive: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  selectedNome: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },
  selectedHint: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  trocarBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#1E3A5F',
  },
  trocarText: { fontSize: 12, fontWeight: '700', color: '#1E3A5F' },

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
