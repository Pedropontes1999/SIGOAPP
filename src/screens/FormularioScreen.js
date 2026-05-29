import React, { useState, useMemo, useRef } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  StatusBar,
  Modal,
  Pressable,
  FlatList,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { loadTrajetoSession, clearTrajetoSession } from '../storage/session';
import { getPlaceholderMembers, getMembersByParceira } from '../data/mockMembers';
import { useEffect } from 'react';

// Quantidade de colaboradores por tipo de composição
const COMPOSICAO_SIZE = { A3: 2, B1: 4, B2: 6, B3: 7, C1: 2, C2: 5, L3: 2 };

export default function FormularioScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);

  // Se há sessão de trajeto ativa, redireciona direto para TrajetoScreen
  useEffect(() => {
    loadTrajetoSession().then(session => {
      if (session && session.stage && session.stage !== 'encerrado') {
        navigation.replace('Trajeto', { obra: session.obra ?? {} });
      } else if (session) {
        clearTrajetoSession();
      }
    });
  }, []);

  const [showImport, setShowImport] = useState(false);
  const [arquivoSelecionado, setArquivoSelecionado] = useState(null);
  const [projetoSelecionado, setProjetoSelecionado] = useState(null);

  // Tamanho da equipe: usa qtdColaboradores do usuário ou infere pela composição
  const teamSize = user?.qtdColaboradores ?? COMPOSICAO_SIZE[user?.composicao] ?? 1;

  const [liderVisible, setLiderVisible] = useState(true);

  // Membros pré-preenchidos com base na sigla do usuário (vêm do mockMembers)
  const [teamMembers, setTeamMembers] = useState(() =>
    getPlaceholderMembers(user).map(label => ({ label, visible: true }))
  );

  // Membros extras adicionados manualmente com autocomplete
  const [extras, setExtras] = useState([]);

  // Todos os membros da parceira do usuário para sugerir no autocomplete
  const parceiraMembros = useMemo(
    () => getMembersByParceira(user?.parceira ?? ''),
    [user?.parceira]
  );

  const visiblePreset = teamMembers.filter(m => m.visible);
  const totalVisible =
    (liderVisible ? 1 : 0) + visiblePreset.length + extras.length;

  // Botão confirmar só ativa quando todos os extras tiverem membro selecionado
  const allComplete = extras.every(e => e.selected != null);

  // Esconde membro pré-preenchido (não remove, só oculta)
  function removeMember(index) {
    setTeamMembers(prev => prev.map((m, i) => i === index ? { ...m, visible: false } : m));
  }

  function addExtra() {
    setExtras(prev => [...prev, { id: Date.now(), query: '', selected: null, open: false }]);
  }

  // Atualiza texto de busca e abre dropdown de sugestões
  function updateQuery(id, query) {
    setExtras(prev => prev.map(e =>
      e.id === id ? { ...e, query, selected: null, open: query.length > 0 } : e
    ));
  }

  // Confirma membro selecionado no autocomplete e fecha dropdown
  function selectMember(id, member) {
    setExtras(prev => prev.map(e =>
      e.id === id ? { ...e, query: member, selected: member, open: false } : e
    ));
  }

  function removeExtra(id) {
    setExtras(prev => prev.filter(e => e.id !== id));
  }

  // Abre seletor de arquivo Excel ou PDF para a obra
  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setArquivoSelecionado(result.assets[0]);
    }
  }

  // Abre seletor de PDF do projeto separado
  async function pickProjeto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProjetoSelecionado(result.assets[0]);
    }
  }

  // Navega para ObraScreen passando o arquivo importado e o PDF do projeto
  function confirmarImportacao() {
    setShowImport(false);
    navigation.navigate('Obra', { arquivo: arquivoSelecionado, projeto: projetoSelecionado });
  }

  // Computa a posição numérica visível de cada slot na lista (líder + preset + extras)
  let posCounter = 0;
  const liderPos = liderVisible ? ++posCounter : null;
  const presetPositions = teamMembers.map(m => m.visible ? ++posCounter : null);
  const extraPositions = extras.map(() => ++posCounter);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={styles.headerTitle}>Novo Trajeto</Text>
          <Text style={styles.headerSub}>Olá, {user?.nome?.split(' ')[0]}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={openSidebar} style={styles.menuBtn}>
            <Text style={styles.menuBtnText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={[styles.scroll, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Card de dados do usuário logado (somente leitura) */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <View style={styles.cardHeader}>
            <Text style={[styles.cardTitle, { color: colors.text }]}>Dados</Text>
            <TouchableOpacity onPress={() => setDetailsCollapsed(v => !v)}>
              <Text style={[styles.toggleText, { color: colors.linkText }]}>
                {detailsCollapsed ? 'Ver ▼' : 'Ocultar ▲'}
              </Text>
            </TouchableOpacity>
          </View>

          {!detailsCollapsed && (
            <>
              <ReadOnlyField label="Nome" value={user?.nome} />
              <View style={styles.row}>
                <View style={styles.half}>
                  <ReadOnlyField label="Sigla" value={user?.sigla} />
                </View>
                <View style={styles.half}>
                  <ReadOnlyField label="Parceira" value={user?.parceira} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <ReadOnlyField label="Composição" value={user?.composicao} />
                </View>
                <View style={styles.half}>
                  <ReadOnlyField label="Tipo de Equipe" value={user?.tipoEquipe} />
                </View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}>
                  <ReadOnlyField label="Placa do Veículo" value={user?.placa} />
                </View>
                <View style={styles.half}>
                  <ReadOnlyField label="Tipo de Veículo" value={user?.tipoVeiculo} />
                </View>
              </View>
            </>
          )}

          {/* Resumo compacto quando o card está recolhido */}
          {detailsCollapsed && (
            <Text style={[styles.collapsedSummary, { color: colors.textSub }]}>
              {user?.sigla} · {user?.parceira} · {user?.composicao} · {user?.placa}
            </Text>
          )}
        </View>

        {/* Card de montagem da equipe */}
        <View style={[styles.card, { marginTop: 12, backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>
            Equipe ({totalVisible})
          </Text>

          {/* Líder: sempre é o próprio usuário logado */}
          {liderVisible && (
            <View style={styles.memberRow}>
              <View style={[styles.memberBadge, { backgroundColor: '#16A34A' }]}>
                <Text style={styles.memberBadgeText}>{liderPos}</Text>
              </View>
              <View style={[styles.memberBox, { flex: 1, backgroundColor: colors.memberDisplay, borderColor: '#16A34A' }]}>
                <Text style={[styles.memberSelf, { color: colors.memberSelf }]}>{user?.nome}</Text>
              </View>
              <TouchableOpacity style={styles.minusBtn} onPress={() => setLiderVisible(false)} activeOpacity={0.75}>
                <Feather name="minus" size={16} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}

          {/* Membros pré-preenchidos (ocultar não remove, apenas esconde) */}
          {teamMembers.map((member, index) => {
            if (!member.visible) return null;
            const pos = presetPositions[index];
            return (
              <View key={index} style={styles.memberRow}>
                <View style={[styles.memberBadge, { backgroundColor: '#16A34A' }]}>
                  <Text style={styles.memberBadgeText}>{pos}</Text>
                </View>
                <View style={[styles.memberBox, { flex: 1, backgroundColor: colors.memberDisplay, borderColor: '#16A34A' }]}>
                  <Text style={[styles.memberLabel, { color: colors.text }]}>{member.label}</Text>
                </View>
                <TouchableOpacity style={styles.minusBtn} onPress={() => removeMember(index)} activeOpacity={0.75}>
                  <Feather name="minus" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            );
          })}

          {/* Extras: campo de busca com autocomplete e dropdown de sugestões */}
          {extras.map((extra, i) => {
            const pos = extraPositions[i];
            const suggestions = extra.selected
              ? []
              : parceiraMembros.filter(m =>
                  extra.query.trim().length > 0 &&
                  m.toLowerCase().includes(extra.query.toLowerCase())
                ).slice(0, 8); // limita sugestões a 8 itens

            return (
              <View key={extra.id}>
                <View style={styles.memberRow}>
                  <View style={[styles.memberBadge, { backgroundColor: '#F59E0B' }]}>
                    <Text style={styles.memberBadgeText}>{pos}</Text>
                  </View>
                  {extra.selected ? (
                    <View style={[styles.memberBox, { flex: 1, backgroundColor: colors.memberDisplay, borderColor: '#F59E0B' }]}>
                      <Text style={[styles.memberLabel, { color: colors.text }]}>{extra.selected}</Text>
                    </View>
                  ) : (
                    <TextInput
                      style={[styles.subInput, { flex: 1, backgroundColor: colors.inputBg, borderColor: '#F59E0B', color: colors.inputText }]}
                      placeholder="Buscar membro..."
                      placeholderTextColor={colors.textMuted}
                      value={extra.query}
                      onChangeText={q => updateQuery(extra.id, q)}
                      autoCapitalize="words"
                      autoFocus={i === extras.length - 1}
                    />
                  )}
                  <TouchableOpacity style={styles.minusBtn} onPress={() => removeExtra(extra.id)} activeOpacity={0.75}>
                    <Feather name="minus" size={16} color="#FFF" />
                  </TouchableOpacity>
                </View>

                {suggestions.length > 0 && (
                  <View style={[styles.dropdown, { backgroundColor: colors.card }]}>
                    {suggestions.map((s, si) => (
                      <TouchableOpacity
                        key={si}
                        style={[styles.dropdownItem, si < suggestions.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border ?? '#E5E7EB' }]}
                        onPress={() => selectMember(extra.id, s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.dropdownText, { color: colors.text }]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}

                {/* Mensagem quando a busca não retorna resultados */}
                {extra.query.trim().length > 0 && !extra.selected && suggestions.length === 0 && (
                  <View style={[styles.dropdown, { backgroundColor: colors.card }]}>
                    <Text style={[styles.dropdownEmpty, { color: colors.textMuted }]}>
                      Nenhum membro encontrado para "{user?.parceira}"
                    </Text>
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={styles.addExtraBtn} onPress={addExtra} activeOpacity={0.8}>
            <Feather name="plus" size={16} color="#16A34A" />
            <Text style={styles.addExtraBtnText}>Adicionar membro</Text>
          </TouchableOpacity>
        </View>

        {/* Confirmar equipe abre o modal de importação de arquivos */}
        <TouchableOpacity
          style={[styles.iniciarBtn, !allComplete && styles.iniciarBtnDisabled]}
          disabled={!allComplete}
          onPress={() => { setArquivoSelecionado(null); setShowImport(true); }}
          activeOpacity={0.85}
        >
          <Text style={styles.iniciarBtnText}>Confirmar Equipe</Text>
        </TouchableOpacity>

        {!allComplete && (
          <Text style={styles.hint}>Selecione um membro da lista para continuar</Text>
        )}
      </ScrollView>

      {/* Modal de importação: Excel/PDF da obra + PDF do projeto */}
      <Modal
        visible={showImport}
        transparent
        animationType="fade"
        onRequestClose={() => setShowImport(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowImport(false)}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            <Text style={styles.modalTitle}>Importar Arquivos</Text>

            <Text style={styles.modalSectionLabel}>Nota / Ordem de Trabalho</Text>
            <Text style={styles.modalSub}>Excel com as obras do dia</Text>
            <TouchableOpacity style={[styles.pickBtn, arquivoSelecionado && styles.pickBtnDone]} onPress={pickFile} activeOpacity={0.8}>
              <Feather name="file-text" size={18} color={arquivoSelecionado ? '#16A34A' : '#6B7280'} />
              <Text style={styles.pickBtnText} numberOfLines={1}>
                {arquivoSelecionado ? arquivoSelecionado.name : 'Escolher arquivo'}
              </Text>
            </TouchableOpacity>

            <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>Projeto (PDF)</Text>
            <Text style={styles.modalSub}>PDF do projeto da obra</Text>
            <TouchableOpacity style={[styles.pickBtn, projetoSelecionado && styles.pickBtnDone]} onPress={pickProjeto} activeOpacity={0.8}>
              <Feather name="file" size={18} color={projetoSelecionado ? '#16A34A' : '#6B7280'} />
              <Text style={styles.pickBtnText} numberOfLines={1}>
                {projetoSelecionado ? projetoSelecionado.name : 'Escolher PDF'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowImport(false)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              {/* Continuar exige ao menos o arquivo da obra */}
              <TouchableOpacity
                style={[styles.continueBtn, !arquivoSelecionado && styles.continueBtnDisabled]}
                onPress={confirmarImportacao}
                disabled={!arquivoSelecionado}
                activeOpacity={0.8}
              >
                <Text style={styles.continueBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

// Campo somente leitura reutilizável para exibir dados do usuário
function ReadOnlyField({ label, value }) {
  const { colors } = useTheme();
  return (
    <View style={rf.wrapper}>
      <Text style={[rf.label, { color: colors.fieldLabel }]}>{label}</Text>
      <View style={[rf.box, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
        <Text style={[rf.value, { color: colors.text }]}>{value || '—'}</Text>
      </View>
    </View>
  );
}

const rf = StyleSheet.create({
  wrapper: { marginTop: 14 },
  label: { fontSize: 12, fontWeight: '600', marginBottom: 5 },
  box: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 11,
  },
  value: { fontSize: 13, fontWeight: '400' },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#1E3A5F',
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 13, color: '#93C5FD', marginTop: 2 },
  backBtn: { padding: 4 },
  backText: { color: '#93C5FD', fontSize: 14, fontWeight: '600' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8,
  },
  logoutText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  menuBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  menuBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  scroll: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  toggleText: { fontSize: 12, fontWeight: '600' },
  collapsedSummary: { fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },

  memberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  memberBadge: {
    width: 26, height: 26, borderRadius: 13,
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  memberBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  memberBox: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  memberSelf: { fontSize: 14, fontWeight: '700' },
  memberLabel: { fontSize: 13, fontWeight: '500' },
  minusBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: '#6B7280',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  subInput: {
    borderWidth: 1.5, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 13,
  },

  dropdown: {
    marginLeft: 34, marginRight: 44, marginTop: 2,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14, paddingVertical: 11,
  },
  dropdownText: { fontSize: 13 },
  dropdownEmpty: {
    paddingHorizontal: 14, paddingVertical: 11, fontSize: 12, fontStyle: 'italic',
  },

  addExtraBtn: {
    marginTop: 14, borderWidth: 1.5, borderColor: '#16A34A',
    borderStyle: 'dashed', borderRadius: 12,
    paddingVertical: 11, alignItems: 'center',
    flexDirection: 'row', justifyContent: 'center', gap: 6,
  },
  addExtraBtnText: { color: '#16A34A', fontSize: 14, fontWeight: '700' },

  iniciarBtn: {
    backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20, elevation: 5,
  },
  iniciarBtnDisabled: { backgroundColor: '#D1D5DB', elevation: 0 },
  iniciarBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
  hint: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 8 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24,
    width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  modalTitle: {
    fontSize: 16, fontWeight: '800', color: '#1E3A5F',
    textAlign: 'center', marginBottom: 8,
  },
  modalSectionLabel: { fontSize: 13, fontWeight: '700', color: '#1E3A5F', marginBottom: 2 },
  modalSub: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  pickBtn: {
    borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12,
    alignItems: 'center', flexDirection: 'row', gap: 8,
    backgroundColor: '#F9FAFB',
  },
  pickBtnDone: { borderColor: '#16A34A', borderStyle: 'solid', backgroundColor: '#F0FDF4' },
  pickBtnText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  continueBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    backgroundColor: '#1E3A5F', alignItems: 'center',
  },
  continueBtnDisabled: { backgroundColor: '#D1D5DB' },
  continueBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
});
