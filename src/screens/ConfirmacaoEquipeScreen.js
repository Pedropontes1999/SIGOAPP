import React, { useMemo, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, Modal, TextInput,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getRosterEquipe } from '../data/mockMembers';

// Funções sugeridas ao adicionar um funcionário que veio no lugar de outro
const FUNCOES_SUGERIDAS = ['Eletricista', 'Motorista', 'Ajudante', 'Auxiliar', 'Encarregado'];

// Iniciais do nome para o avatar
function iniciais(nome) {
  const partes = String(nome || '').trim().split(/\s+/);
  return ((partes[0]?.[0] ?? '') + (partes[1]?.[0] ?? '')).toUpperCase() || '?';
}

export default function ConfirmacaoEquipeScreen({ route, navigation }) {
  const { colors } = useTheme();

  const equipe     = route?.params?.equipe ?? {};
  const onConfirmar = route?.params?.onConfirmar;
  // presença já registrada antes (ao reabrir a equipe) ou tudo presente por padrão
  const presencaInicial = route?.params?.presencas;

  const roster = useMemo(() => getRosterEquipe(equipe.sigla), [equipe.sigla]);

  // Funcionários adicionados manualmente (vieram no lugar de alguém ausente)
  const [extras, setExtras] = useState(() => route?.params?.extras ?? []);

  // Lista completa exibida = roster cadastrado + extras adicionados na conferência
  const membros = useMemo(() => [...roster, ...extras], [roster, extras]);

  // Map id -> boolean (true = presente). Começa todos presentes.
  const [presencas, setPresencas] = useState(() => {
    const init = {};
    [...roster, ...(route?.params?.extras ?? [])].forEach(m => {
      init[m.id] = presencaInicial ? !!presencaInicial[m.id] : true;
    });
    return init;
  });

  // Modal de "adicionar funcionário"
  const [showAddModal, setShowAddModal] = useState(false);
  const [novoNome, setNovoNome]         = useState('');
  const [novaFuncao, setNovaFuncao]     = useState('');

  const presentes = membros.filter(m => presencas[m.id]).length;
  const ausentes  = membros.length - presentes;

  function setPresenca(id, valor) {
    setPresencas(prev => ({ ...prev, [id]: valor }));
  }

  function abrirAddModal() {
    setNovoNome('');
    setNovaFuncao('');
    setShowAddModal(true);
  }

  function adicionarFuncionario() {
    const nome = novoNome.trim();
    if (!nome) return;
    const novo = { id: `${equipe.sigla}-extra-${Date.now()}`, nome, funcao: novaFuncao.trim() || 'Colaborador', extra: true };
    setExtras(prev => [...prev, novo]);
    setPresencas(prev => ({ ...prev, [novo.id]: true }));
    setShowAddModal(false);
  }

  function removerExtra(id) {
    setExtras(prev => prev.filter(m => m.id !== id));
    setPresencas(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  function confirmar() {
    onConfirmar?.(presencas, extras);
    navigation.goBack();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Conferência da equipe</Text>
          <Text style={styles.headerSub}>{equipe.sigla} · {equipe.parceira || '—'}</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}>
        {/* Resumo */}
        <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.summaryTitle, { color: colors.heading }]}>
            {[equipe.tipoEquipe, equipe.composicao].filter(Boolean).join(' · ') || 'Equipe'}
          </Text>
          <Text style={[styles.summaryHint, { color: colors.equipeSub }]}>
            Confirme quem está na obra
          </Text>
          <View style={styles.summaryTags}>
            <View style={[styles.tag, styles.tagPresente]}>
              <Feather name="check" size={13} color="#15803D" />
              <Text style={styles.tagPresenteText}>{presentes} presente{presentes !== 1 ? 's' : ''}</Text>
            </View>
            <View style={[styles.tag, styles.tagAusente]}>
              <Feather name="x" size={13} color="#B91C1C" />
              <Text style={styles.tagAusenteText}>{ausentes} ausente{ausentes !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>

        {/* Lista de trabalhadores com toggle Presente / Ausente */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          {membros.map((m, idx) => {
            const presente = presencas[m.id];
            return (
              <View
                key={m.id}
                style={[
                  styles.row,
                  { borderBottomColor: colors.equipeRowBorder },
                  idx === membros.length - 1 && { borderBottomWidth: 0 },
                ]}
              >
                <View style={[styles.avatar, !presente && styles.avatarAusente]}>
                  <Text style={[styles.avatarText, !presente && styles.avatarTextAusente]}>{iniciais(m.nome)}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.nome, { color: colors.equipeNome }]} numberOfLines={1}>{m.nome}</Text>
                  <Text style={[styles.funcao, { color: colors.equipeSub }]}>{m.funcao}</Text>
                </View>

                <View style={styles.toggle}>
                  <TouchableOpacity
                    style={[styles.toggleBtn, styles.toggleLeft, presente && styles.togglePresenteAtivo]}
                    onPress={() => setPresenca(m.id, true)}
                    activeOpacity={0.8}
                  >
                    <Feather name="check" size={14} color={presente ? '#FFF' : '#9CA3AF'} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.toggleBtn, styles.toggleRight, !presente && styles.toggleAusenteAtivo]}
                    onPress={() => setPresenca(m.id, false)}
                    activeOpacity={0.8}
                  >
                    <Feather name="x" size={14} color={!presente ? '#FFF' : '#9CA3AF'} />
                  </TouchableOpacity>
                </View>

                {m.extra && (
                  <TouchableOpacity style={styles.removeExtra} onPress={() => removerExtra(m.id)} activeOpacity={0.7}>
                    <Feather name="trash-2" size={16} color="#B91C1C" />
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </View>

        {/* Adicionar funcionário que veio no lugar de um ausente */}
        <TouchableOpacity style={[styles.addBtn, { borderColor: colors.equipeRowBorder }]} onPress={abrirAddModal} activeOpacity={0.8}>
          <Feather name="user-plus" size={18} color="#1E3A5F" />
          <Text style={styles.addBtnText}>Adicionar funcionário</Text>
        </TouchableOpacity>
      </ScrollView>

      <View style={[styles.footer, { backgroundColor: colors.footerBg, borderTopColor: colors.footerBorder }]}>
        <TouchableOpacity style={styles.footerBtn} onPress={confirmar} activeOpacity={0.85}>
          <Feather name="check-circle" size={18} color="#FFF" />
          <Text style={styles.footerBtnText}>Confirmar equipe</Text>
        </TouchableOpacity>
      </View>

      {/* Modal: adicionar funcionário (substituto enviado pela parceira) */}
      <Modal visible={showAddModal} transparent animationType="fade" onRequestClose={() => setShowAddModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.heading }]}>Adicionar funcionário</Text>
            <Text style={[styles.modalSub, { color: colors.equipeSub }]}>
              Para quando a parceira envia alguém no lugar de um ausente.
            </Text>

            <Text style={[styles.modalLabel, { color: colors.heading }]}>Nome</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.equipeRowBorder, color: colors.equipeNome }]}
              value={novoNome}
              onChangeText={setNovoNome}
              placeholder="Nome completo"
              placeholderTextColor="#9CA3AF"
              autoFocus
            />

            <Text style={[styles.modalLabel, { color: colors.heading }]}>Função</Text>
            <View style={styles.funcoesWrap}>
              {FUNCOES_SUGERIDAS.map(f => {
                const ativo = novaFuncao === f;
                return (
                  <TouchableOpacity
                    key={f}
                    style={[styles.funcaoChip, { borderColor: colors.equipeRowBorder }, ativo && styles.funcaoChipAtivo]}
                    onPress={() => setNovaFuncao(f)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.funcaoChipText, { color: colors.equipeNome }, ativo && styles.funcaoChipTextAtivo]}>{f}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.equipeRowBorder, color: colors.equipeNome, marginTop: 8 }]}
              value={novaFuncao}
              onChangeText={setNovaFuncao}
              placeholder="Ou digite outra função"
              placeholderTextColor="#9CA3AF"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: colors.equipeRowBorder }]} onPress={() => setShowAddModal(false)} activeOpacity={0.8}>
                <Text style={[styles.modalCancelText, { color: colors.equipeSub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, !novoNome.trim() && styles.modalConfirmDisabled]} onPress={adicionarFuncionario} disabled={!novoNome.trim()} activeOpacity={0.8}>
                <Text style={styles.modalConfirmText}>Adicionar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#93C5FD', marginTop: 1 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  body: { flexGrow: 1, padding: 16, paddingBottom: 100 },

  summaryCard: {
    borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  summaryTitle: { fontSize: 15, fontWeight: '800' },
  summaryHint: { fontSize: 12, marginTop: 2 },
  summaryTags: { flexDirection: 'row', gap: 8, marginTop: 12 },
  tag: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 },
  tagPresente: { backgroundColor: '#DCFCE7' },
  tagPresenteText: { fontSize: 12, fontWeight: '700', color: '#15803D' },
  tagAusente: { backgroundColor: '#FEE2E2' },
  tagAusenteText: { fontSize: 12, fontWeight: '700', color: '#B91C1C' },

  card: {
    borderRadius: 16, paddingHorizontal: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#1E3A5F',
    justifyContent: 'center', alignItems: 'center',
  },
  avatarAusente: { backgroundColor: '#E5E7EB' },
  avatarText: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  avatarTextAusente: { color: '#9CA3AF' },
  nome: { fontSize: 14, fontWeight: '700' },
  funcao: { fontSize: 12, marginTop: 1 },

  toggle: {
    flexDirection: 'row', borderRadius: 10, overflow: 'hidden',
    borderWidth: 1.5, borderColor: '#E5E7EB',
  },
  toggleBtn: { width: 42, height: 34, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F9FAFB' },
  toggleLeft: { borderRightWidth: 1.5, borderRightColor: '#E5E7EB' },
  toggleRight: {},
  togglePresenteAtivo: { backgroundColor: '#16A34A' },
  toggleAusenteAtivo: { backgroundColor: '#DC2626' },

  removeExtra: { padding: 6, marginLeft: 4 },

  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 12, paddingVertical: 14, borderRadius: 14,
    borderWidth: 1.5, borderStyle: 'dashed',
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  footerBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14,
  },
  footerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Modal adicionar funcionário
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    borderRadius: 20, padding: 24, width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalSub: { fontSize: 12, marginTop: 4, marginBottom: 14 },
  modalLabel: { fontSize: 13, fontWeight: '700', marginTop: 8, marginBottom: 6 },
  modalInput: {
    borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14,
  },
  funcoesWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  funcaoChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  funcaoChipAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  funcaoChipText: { fontSize: 13, fontWeight: '600' },
  funcaoChipTextAtivo: { color: '#FFF', fontWeight: '800' },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  modalCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#1E3A5F', alignItems: 'center' },
  modalConfirmDisabled: { backgroundColor: '#D1D5DB' },
  modalConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
