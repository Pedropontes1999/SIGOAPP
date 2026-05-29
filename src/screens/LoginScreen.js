import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  ScrollView,
} from 'react-native';
import { MOCK_USERS } from '../data/mockUsers';

// Deriva lista única e ordenada de parceiras a partir dos usuários terceirizados
const PARCEIRAS = (() => {
  const set = new Set(
    Object.values(MOCK_USERS)
      .filter(u => u.role === 'tercerizado' && u.parceira)
      .map(u => u.parceira)
  );
  return Array.from(set).sort();
})();

export default function LoginScreen({ navigation }) {
  const [selectedParceira, setSelectedParceira] = useState(null);

  // Clicando na mesma parceira novamente, deseleciona
  function handleParceira(p) {
    setSelectedParceira(prev => prev === p ? null : p);
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.logoContainer}>
          <Text style={styles.logoText}>SIgo</Text>
          <Text style={styles.logoSub}>Sistema de Gestão de Rotas</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Selecione sua parceira</Text>

          {/* Chips de parceira — minWidth uniforme, texto em maiúsculo */}
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

          {/* Próximo habilitado apenas com parceira selecionada */}
          <TouchableOpacity
            style={[styles.btn, !selectedParceira && styles.btnDisabled]}
            disabled={!selectedParceira}
            onPress={() => navigation.navigate('LoginForm', { parceira: selectedParceira })}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>Próximo</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  logoContainer: { alignItems: 'center', marginBottom: 36 },
  logoText: { fontSize: 52, fontWeight: '900', color: '#FFFFFF', letterSpacing: 4 },
  logoSub: { fontSize: 13, color: '#93C5FD', marginTop: 4, letterSpacing: 1 },
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16, padding: 24,
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 12, elevation: 8,
  },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#1E3A5F', marginBottom: 20 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  chip: {
    minWidth: 110, paddingHorizontal: 16, paddingVertical: 10,
    borderRadius: 20, borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  chipActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  chipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  chipTextActive: { color: '#FFFFFF' },
  backBtn: { alignSelf: 'flex-start', marginBottom: 8 },
  backText: { color: '#93C5FD', fontSize: 14, fontWeight: '600' },
  btn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center',
  },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
