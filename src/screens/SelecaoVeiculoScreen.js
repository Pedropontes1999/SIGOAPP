import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { VEICULOS } from '../data/veiculos';

export default function SelecaoVeiculoScreen({ navigation }) {
  const { user, logout, selectVeiculo } = useAuth();
  const { colors } = useTheme();
  const [busca, setBusca]             = useState('');
  const [selecionada, setSelecionada] = useState(null);
  const [aberto, setAberto]           = useState(new Set()); // modelos expandidos

  const buscando = busca.trim().length > 0;

  // Agrupa os veículos por modelo, já aplicando o filtro de busca
  const grupos = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const map = new Map();
    for (const v of VEICULOS) {
      const match = !q || v.placa.toUpperCase().includes(q) || v.modelo.toUpperCase().includes(q);
      if (!match) continue;
      if (!map.has(v.modelo)) map.set(v.modelo, []);
      map.get(v.modelo).push(v);
    }
    return [...map.entries()]
      .map(([modelo, veiculos]) => ({ modelo, veiculos }))
      .sort((a, b) => a.modelo.localeCompare(b.modelo));
  }, [busca]);

  const totalFiltrado = useMemo(
    () => grupos.reduce((acc, g) => acc + g.veiculos.length, 0),
    [grupos]
  );

  // Durante a busca tudo fica aberto; fora dela respeita o que o usuário expandiu
  function isAberto(modelo) {
    return buscando || aberto.has(modelo);
  }

  function toggleGrupo(modelo) {
    setAberto(prev => {
      const next = new Set(prev);
      next.has(modelo) ? next.delete(modelo) : next.add(modelo);
      return next;
    });
  }

  function handleConfirmar() {
    if (!selecionada) return;
    selectVeiculo(selecionada);
    navigation.navigate('ImportInterno');
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Selecione o veículo</Text>
          <Text style={styles.headerSub}>Olá, {user?.nome?.split(' ')[0]}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>Sair</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { backgroundColor: colors.bg }, selecionada && { paddingBottom: 96 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Busca por placa ou modelo */}
        <View style={[styles.searchWrapper, { backgroundColor: colors.card, borderColor: colors.chipBorder }]}>
          <Feather name="search" size={18} color="#9CA3AF" />
          <TextInput
            style={[styles.searchInput, { color: colors.heading }]}
            placeholder="Buscar por placa ou modelo"
            placeholderTextColor="#9CA3AF"
            value={busca}
            onChangeText={setBusca}
            autoCapitalize="characters"
          />
          {buscando && (
            <TouchableOpacity onPress={() => setBusca('')} hitSlop={8}>
              <Feather name="x" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        <Text style={[styles.totalLabel, { color: colors.equipeSub }]}>
          {totalFiltrado} veículo{totalFiltrado !== 1 ? 's' : ''} disponíve{totalFiltrado !== 1 ? 'is' : 'l'}
        </Text>

        {grupos.length === 0 ? (
          <Text style={[styles.empty, { color: colors.equipeSub }]}>Nenhum veículo encontrado.</Text>
        ) : (
          grupos.map(g => {
            const open = isAberto(g.modelo);
            return (
              <View key={g.modelo} style={[styles.groupCard, { backgroundColor: colors.card }]}>
                {/* Cabeçalho do modelo — clique na seta para abrir/fechar */}
                <TouchableOpacity
                  style={styles.groupHeader}
                  onPress={() => toggleGrupo(g.modelo)}
                  activeOpacity={0.7}
                  disabled={buscando}
                >
                  <View style={styles.groupHeaderLeft}>
                    <Feather name="truck" size={18} color={colors.heading} />
                    <Text style={[styles.groupTitle, { color: colors.heading }]}>{g.modelo}</Text>
                    <View style={styles.countPill}>
                      <Text style={styles.countPillText}>{g.veiculos.length}</Text>
                    </View>
                  </View>
                  {!buscando && (
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={22} color="#9CA3AF" />
                  )}
                </TouchableOpacity>

                {/* Lista de placas do modelo — uma por linha, fácil de tocar */}
                {open && (
                  <View style={styles.plateList}>
                    {g.veiculos.map(v => {
                      const isSelected = selecionada?.placa === v.placa;
                      return (
                        <TouchableOpacity
                          key={v.placa}
                          style={[
                            styles.plateRow,
                            { borderColor: colors.chipBorder },
                            isSelected && styles.plateRowActive,
                          ]}
                          onPress={() => setSelecionada(isSelected ? null : v)}
                          activeOpacity={0.75}
                        >
                          <View style={[styles.plateBadge, isSelected && styles.plateBadgeActive]}>
                            <Text style={[styles.plateText, isSelected && styles.plateTextActive]}>
                              {v.placa}
                            </Text>
                          </View>
                          <View style={[styles.radio, isSelected && styles.radioActive]}>
                            {isSelected && <Feather name="check" size={13} color="#FFF" />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>

      {/* Footer aparece quando um veículo está selecionado */}
      {selecionada && (
        <View style={[styles.footer, { backgroundColor: colors.footerBg, borderTopColor: colors.footerBorder }]}>
          <TouchableOpacity style={styles.footerBtn} onPress={handleConfirmar} activeOpacity={0.85}>
            <Text style={styles.footerBtnText}>Confirmar {selecionada.placa}</Text>
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
  headerCenter: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#93C5FD', marginTop: 1 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  body: { flexGrow: 1, padding: 16 },
  searchWrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 2,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15 },
  totalLabel: { fontSize: 12, fontWeight: '600', marginTop: 14, marginBottom: 8, marginLeft: 4 },
  empty: { fontSize: 13, paddingVertical: 24, textAlign: 'center' },

  groupCard: {
    borderRadius: 16, marginBottom: 12, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  groupHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 16,
  },
  groupHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupTitle: { fontSize: 15, fontWeight: '800' },
  countPill: {
    backgroundColor: '#1E3A5F', borderRadius: 12, minWidth: 24,
    paddingHorizontal: 8, paddingVertical: 2, alignItems: 'center',
  },
  countPillText: { color: '#FFF', fontSize: 12, fontWeight: '800' },

  plateList: { paddingHorizontal: 12, paddingBottom: 12, gap: 8 },
  plateRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderWidth: 1.5, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
  },
  plateRowActive: { backgroundColor: '#EFF6FF', borderColor: '#1E3A5F' },
  plateBadge: {
    backgroundColor: '#EFF2F7', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
  },
  plateBadgeActive: { backgroundColor: '#1E3A5F' },
  plateText: { fontSize: 15, fontWeight: '800', color: '#1E3A5F', letterSpacing: 1 },
  plateTextActive: { color: '#FFF' },
  radio: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 2,
    borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
  },
  radioActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },

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
