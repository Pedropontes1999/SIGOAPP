import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { MOCK_USERS } from '../data/mockUsers';

// Lista única de parceiras derivada dos usuários terceirizados
const PARCEIRAS = [...new Set(
  Object.values(MOCK_USERS)
    .filter(u => u.role === 'tercerizado' && u.parceira)
    .map(u => u.parceira)
)].sort();

export default function InternoScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [selectedParceira, setSelectedParceira] = useState(null);
  const [selectedSiglas,   setSelectedSiglas]   = useState(new Set());

  // Filtra equipes da parceira selecionada
  const equipes = selectedParceira
    ? Object.values(MOCK_USERS)
        .filter(u => u.role === 'tercerizado' && u.parceira === selectedParceira)
        .sort((a, b) => a.sigla.localeCompare(b.sigla))
    : [];

  // Verifica se todas as equipes visíveis estão marcadas
  const todasSelecionadas = equipes.length > 0 && equipes.every(e => selectedSiglas.has(e.sigla));

  // Trocar de parceira limpa as siglas selecionadas
  function handleParceira(p) {
    setSelectedParceira(prev => prev === p ? null : p);
    setSelectedSiglas(new Set());
  }

  // Toggle individual de sigla na seleção
  function toggleSigla(sigla) {
    setSelectedSiglas(prev => {
      const next = new Set(prev);
      next.has(sigla) ? next.delete(sigla) : next.add(sigla);
      return next;
    });
  }

  // Seleciona ou desmarca todas as equipes de uma vez
  function toggleTodas() {
    setSelectedSiglas(todasSelecionadas ? new Set() : new Set(equipes.map(e => e.sigla)));
  }

  // Navega para fiscalização passando os objetos completos das equipes
  function handleFiscalizar() {
    const equipesParaFiscalizar = [...selectedSiglas].map(s => MOCK_USERS[s]);
    navigation.navigate('Fiscalizacao', { equipes: equipesParaFiscalizar });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Painel Interno</Text>
          <Text style={styles.headerSub}>
            Olá, {user?.nome?.split(' ')[0]}{user?.veiculo ? ` · 🚗 ${user.veiculo.placa}` : ''}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={openSidebar} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.headerBtn}>
            <Text style={styles.headerBtnText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* paddingBottom extra quando footer flutuante aparece */}
      <ScrollView
        contentContainerStyle={[styles.body, { backgroundColor: colors.bg }, selectedSiglas.size > 0 && { paddingBottom: 90 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Seleção de parceira — chips padronizados */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Escolha uma parceira</Text>
          <View style={styles.chipsWrap}>
            {PARCEIRAS.map(p => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.chip,
                  { backgroundColor: colors.chipBg, borderColor: colors.chipBorder },
                  selectedParceira === p && styles.chipActive,
                ]}
                onPress={() => handleParceira(p)}
                activeOpacity={0.7}
              >
                <Text style={[
                  styles.chipText,
                  { color: colors.chipText },
                  selectedParceira === p && styles.chipTextActive,
                ]}>
                  {p.toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Lista de equipes — aparece após selecionar a parceira */}
        {selectedParceira && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: colors.card }]}>
            <View style={styles.equipesHeader}>
              <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>
                Equipes · {selectedParceira}
                <Text style={{ color: colors.heading, fontWeight: '800' }}> {equipes.length}</Text>
              </Text>
              <TouchableOpacity onPress={toggleTodas} activeOpacity={0.7}>
                <Text style={[styles.selecionarTodas, { color: colors.linkText }]}>
                  {todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Cada linha é uma equipe com checkbox, sigla e nome */}
            {equipes.map((e, idx) => {
              const isSelected = selectedSiglas.has(e.sigla);
              return (
                <TouchableOpacity
                  key={e.sigla}
                  style={[
                    styles.equipeRow,
                    { borderBottomColor: colors.equipeRowBorder },
                    isSelected && { backgroundColor: colors.equipeRowActiveBg, borderRadius: 10, paddingHorizontal: 8 },
                    idx === equipes.length - 1 && { borderBottomWidth: 0 },
                  ]}
                  onPress={() => toggleSigla(e.sigla)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.checkbox, isSelected && styles.checkboxActive]}>
                    {isSelected && <Text style={styles.checkmark}>✓</Text>}
                  </View>

                  <View style={[styles.siglaBadge, isSelected && styles.siglaBadgeActive]}>
                    <Text style={[styles.siglaBadgeText, isSelected && styles.siglaBadgeTextActive]} numberOfLines={1}>
                      {e.sigla}
                    </Text>
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.equipeNome, { color: isSelected ? colors.equipeNomeActive : colors.equipeNome }]}>
                      {e.nome}
                    </Text>
                    <Text style={[styles.equipeSub, { color: colors.equipeSub }]}>
                      {e.tipoEquipe} · {e.composicao}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {/* Footer flutuante aparece somente quando ao menos uma equipe está selecionada */}
      {selectedSiglas.size > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.footerBg, borderTopColor: colors.footerBorder }]}>
          <TouchableOpacity style={styles.footerBtn} onPress={handleFiscalizar} activeOpacity={0.85}>
            <Text style={styles.footerBtnText}>
              Fiscalizar {selectedSiglas.size} equipe{selectedSiglas.size > 1 ? 's' : ''}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#93C5FD', marginTop: 1 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  body: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  sectionLabel: { fontSize: 13, fontWeight: '700' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    minWidth: 110, paddingHorizontal: 14, paddingVertical: 9,
    borderRadius: 20, borderWidth: 1.5, alignItems: 'center',
  },
  chipActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: '#FFFFFF' },

  equipesHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 12,
  },
  selecionarTodas: { fontSize: 12, fontWeight: '600' },

  equipeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1,
  },

  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
    backgroundColor: 'transparent',
  },
  checkboxActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  checkmark: { color: '#FFF', fontSize: 13, fontWeight: '800' },

  siglaBadge: {
    backgroundColor: '#E5E7EB', borderRadius: 8, paddingHorizontal: 8,
    paddingVertical: 4, minWidth: 72, alignItems: 'center',
  },
  siglaBadgeActive: { backgroundColor: '#1E3A5F' },
  siglaBadgeText: { fontSize: 11, fontWeight: '800', color: '#1E3A5F' },
  siglaBadgeTextActive: { color: '#FFF' },
  equipeNome: { fontSize: 13, fontWeight: '600' },
  equipeSub: { fontSize: 11, marginTop: 2 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 12,
    borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  footerBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  footerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
