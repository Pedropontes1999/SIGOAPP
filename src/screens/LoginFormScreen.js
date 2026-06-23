import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { MOCK_USERS } from '../data/mockUsers';

// Lista única de parceiras disponíveis para seleção
const PARCEIRAS = [...new Set(
  Object.values(MOCK_USERS)
    .filter(u => u.role === 'tercerizado' && u.parceira)
    .map(u => u.parceira)
)].sort();

export default function LoginFormScreen({ navigation }) {
  const { login } = useAuth();
  const [selectedParceira, setSelectedParceira] = useState(null);
  const [selectedSigla, setSelectedSigla]       = useState(null);
  const [busca, setBusca]                       = useState('');
  const [password, setPassword]                 = useState('1234');
  const [showPassword, setShowPassword]         = useState(false);
  const [loading, setLoading]                   = useState(false);

  // Filtra siglas disponíveis com base na parceira escolhida e na busca
  const siglas = selectedParceira
    ? Object.values(MOCK_USERS)
        .filter(u => u.parceira === selectedParceira)
        .filter(u => {
          const q = busca.trim().toLowerCase();
          if (!q) return true;
          return u.sigla.toLowerCase().includes(q) || u.nome.toLowerCase().includes(q);
        })
        .sort((a, b) => a.sigla.localeCompare(b.sigla))
    : [];

  const selecionado = selectedSigla ? MOCK_USERS[selectedSigla] : null;

  // Trocar de parceira reseta a sigla selecionada
  function handleParceira(p) {
    setBusca('');
    if (selectedParceira === p) {
      setSelectedParceira(null);
      setSelectedSigla(null);
    } else {
      setSelectedParceira(p);
      setSelectedSigla(null);
    }
  }

  async function handleLogin() {
    if (!selectedSigla || !password.trim()) {
      Alert.alert('Atenção', 'Selecione sua sigla e informe a senha.');
      return;
    }
    setLoading(true);
    const success = await login(selectedSigla, password.trim());
    setLoading(false);
    if (!success) Alert.alert('Erro', 'Sigla ou senha incorretos.');
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
          <View style={styles.logoRow}>
            <Text style={styles.logoText}>SIG</Text>
            <Image
              source={require('../../assets/sigo-symbol.png')}
              style={styles.logoSymbol}
              resizeMode="contain"
            />
            <View style={styles.logoDivider} />
            <View style={styles.logoTaglineBlock}>
              <Text style={styles.logoTaglineTop}>Sistema Integrado</Text>
              <Text style={styles.logoTaglineBottom}>Gestão de Obras</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.title}>Entrar</Text>

          {/* Chips de parceira — minWidth uniforme, texto em maiúsculo */}
          <Text style={styles.label}>Escolha sua parceira</Text>
          <View style={styles.chipsWrap}>
            {PARCEIRAS.map(p => (
              <TouchableOpacity
                key={p}
                style={[styles.chip, selectedParceira === p && styles.chipActive]}
                onPress={() => handleParceira(p)}
                activeOpacity={0.7}
              >
                <Text style={[styles.chipText, selectedParceira === p && styles.chipTextActive]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Seleção de sigla aparece somente após escolher a parceira */}
          {selectedParceira && (
            <>
              <Text style={styles.label}>Selecione sua sigla</Text>

              {/* Resumo enxuto quando já há uma sigla escolhida */}
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
                  {/* Busca por sigla ou nome */}
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

                  {/* Lista vertical estilo EDP — badge + nome */}
                  <ScrollView
                    style={styles.userList}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {siglas.length === 0 ? (
                      <Text style={styles.empty}>Nenhuma sigla encontrada.</Text>
                    ) : (
                      siglas.map((u, idx) => (
                        <TouchableOpacity
                          key={u.sigla}
                          style={[styles.userRow, idx === siglas.length - 1 && { borderBottomWidth: 0 }]}
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
              <Feather name={showPassword ? 'eye-off' : 'eye'} size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Botão só ativa quando sigla está selecionada */}
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
  container: { flex: 1, backgroundColor: '#212E3E' },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 40 },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: '#53FF75', fontSize: 14, fontWeight: '600' },
  logoContainer: { alignItems: 'center', marginBottom: 36 },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  logoSymbol: { width: 52, height: 52, marginTop: 4 },
  logoDivider: { width: 2, height: 38, backgroundColor: '#94A3B8', marginHorizontal: 12, borderRadius: 1 },
  logoTaglineBlock: { justifyContent: 'center' },
  logoTaglineTop: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  logoTaglineBottom: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.2 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  title: { fontSize: 22, fontWeight: '700', color: '#1E3A5F', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 14 },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minWidth: 110, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#212E3E', borderColor: '#53FF75' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },

  // Busca
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
    backgroundColor: '#F9FAFB', paddingHorizontal: 12,
  },
  searchInput: { flex: 1, paddingVertical: 11, fontSize: 14, color: '#111827' },

  // Lista de siglas (estilo EDP)
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
    paddingVertical: 6, minWidth: 90, alignItems: 'center',
  },
  siglaBadgeText: { fontSize: 12, fontWeight: '800', color: '#212E3E' },

  // Resumo do selecionado
  selectedRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4,
    borderWidth: 1.5, borderColor: '#212E3E', borderRadius: 12,
    backgroundColor: '#F0FDF4', padding: 12,
  },
  siglaBadgeActive: {
    backgroundColor: '#212E3E', borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, minWidth: 90, alignItems: 'center',
  },
  siglaBadgeTextActive: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  selectedNome: { fontSize: 14, fontWeight: '700', color: '#212E3E' },
  selectedHint: { fontSize: 11, color: '#6B7280', marginTop: 2 },
  trocarBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    backgroundColor: '#FFFFFF', borderWidth: 1.5, borderColor: '#212E3E',
  },
  trocarText: { fontSize: 12, fontWeight: '700', color: '#212E3E' },

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
    backgroundColor: '#53FF75', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 24,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#212E3E', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
});
