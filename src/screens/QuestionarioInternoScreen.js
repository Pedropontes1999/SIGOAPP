import React, { useState, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, Image, Alert, Platform,
  Modal, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DPModal from '../components/DPModal';
import { useTheme } from '../context/ThemeContext';

// Mesma lista de restrições da tela de parceiros (TrajetoScreen)
const RESTRICOES_EXECUCAO = [
  'Animais/Insetos impedindo a execução',
  'Atendimento emergencial',
  'Atraso na liberação (COI)',
  'Atraso no desligamento (Parceira)',
  'Baixa produtividade',
  'Cava em rocha',
  'Depende do cliente',
  'Desligamento não autorizado (COI)',
  'Disponibilidade de material',
  'Erro de projeto',
  'Falha na execução',
  'Falha no planejamento (EDP)',
  'Falha no planejamento (Parceira)',
  'Falta de mão de obra',
  'Falta de material (estoque virtual divergente do contábil)',
  'Falta de material (material em falta no CL)',
  'Falta de material (material previsto para entrega e não entregue)',
  'Falta de material (pendente ajuste de projeto na viabilidade)',
  'Falta de material (solicitação de material - data de necessidade indicada)',
  'Falta de material (solicitação de material - data inserida tardiamente)',
  'Fatores climáticos (chuva, vento)',
  'Indisponibilidade devido uso mútuo',
  'Manobra não realizada (COI)',
  'Não autorizado por terceiros (cliente)',
  'Obra foi executada por outra obra',
  'Problemas mecânicos (equipamentos)',
  'Repriorização (obras de mercado)',
  'Reprogramação a pedido da EDP',
  'Reprogramação Prevista',
  'Segurança',
  'Sem acesso',
  'Trânsito',
];

// No EDP só permanece o checklist DP (Ficha Medição Aterramento e Ficha
// Equipamento foram removidos a pedido)
const CHECKLISTS = [
  { id: 3, nome: 'DP' },
];

const AS_BUILD_LABELS = [
  { label: 'Visão geral da obra', obrigatoria: true },
  { label: 'Visão com equipamentos instalados', obrigatoria: true },
  { label: 'Foto adicional', obrigatoria: false },
];

export default function QuestionarioInternoScreen({ route, navigation }) {
  const { colors } = useTheme();
  const equipes = route?.params?.equipes ?? [];

  // Obra usada para preencher os campos informativos do DP
  const primeiraObra = useMemo(
    () => equipes.flatMap(e => e.obras ?? [])[0] ?? {},
    [equipes]
  );

  // Pontos de trabalho agregados das obras de todas as equipes selecionadas.
  // Cada obra traz a coluna "Ponto de Trabalho" (ex: "2,5,8"); identificamos
  // a origem pela sigla da equipe e pela OV.
  const [pontosExecucao, setPontosExecucao] = useState(() => {
    const lista = [];
    equipes.forEach(eq => {
      (eq.obras ?? []).forEach(obra => {
        const raw = obra?.['Ponto de Trabalho'] ?? '';
        const ov = String(obra?.['OVNOTA'] ?? '');
        if (raw) {
          String(raw).split(',').forEach(p => {
            lista.push({ ponto: p.trim(), sigla: eq.sigla, ov, executado: '', restricao: '', responsabilidade: '', observacao: '' });
          });
        }
      });
    });
    if (lista.length === 0) {
      lista.push({ ponto: '1 (teste)', sigla: '', ov: '', executado: '', restricao: '', responsabilidade: '', observacao: '' });
    }
    return lista;
  });

  const [checklistsFeitos, setChecklistsFeitos] = useState({});
  const [checklistsNA, setChecklistsNA]         = useState({});
  const [modalChecklistAberto, setModalChecklistAberto] = useState(null);
  const [dadosFichas, setDadosFichas]           = useState({ 3: null });
  const [alteracaoExecucao, setAlteracaoExecucao] = useState('');
  const [justificativaAlteracao, setJustificativaAlteracao] = useState('');
  const [observacoesGerais, setObservacoesGerais] = useState('');
  const [restricaoPickerIdx, setRestricaoPickerIdx] = useState(null);
  const [fotos, setFotos] = useState([null, null, null]);

  async function tirarFoto(index) {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à câmera.');
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7 });
    if (!result.canceled && result.assets?.length > 0) {
      setFotos(prev => prev.map((f, i) => i === index ? result.assets[0].uri : f));
    }
  }

  async function anexarFoto(index) {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setFotos(prev => prev.map((f, i) => i === index ? result.assets[0].uri : f));
    }
  }

  function removerFoto(index) {
    setFotos(prev => prev.map((f, i) => i === index ? null : f));
  }

  const todosChecklistsFeitos = CHECKLISTS.every(c => checklistsFeitos[c.id] || checklistsNA[c.id]);
  const todasFotos = fotos[0] !== null && fotos[1] !== null;
  const podeEnviar = todosChecklistsFeitos && todasFotos;

  function handleEnviar() {
    if (!podeEnviar) {
      Alert.alert('Atenção', 'Complete o checklist DP e as 2 fotos obrigatórias do AS BUILD para enviar.');
      return;
    }
    Alert.alert('Questionário enviado', 'O questionário foi registrado com sucesso.');
    navigation.popToTop();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Questionário</Text>
          <Text style={styles.headerSub}>{equipes.length} equipe{equipes.length !== 1 ? 's' : ''} conferida{equipes.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ width: 64 }} />
      </View>

      <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]} keyboardShouldPersistTaps="handled">
        <View style={[styles.card, { backgroundColor: colors.card }]}>

          {/* ── EXECUÇÃO ── */}
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>Execução</Text>

          {pontosExecucao.length > 0 && (
            <>
              <View style={styles.pontosHeader}>
                <Text style={[styles.pontoHeaderCell, { flex: 1 }]}>Ponto{'\n'}Programado</Text>
                <Text style={[styles.pontoHeaderCell, { flex: 3 }]}>Ponto foi{'\n'}executado?</Text>
              </View>
              {pontosExecucao.map((item, idx) => {
                const precisaJustificativa = item.executado === 'Parcial' || item.executado === 'Não';
                return (
                  <View key={idx}>
                    <View style={styles.pontoRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.pontoCellPonto, { color: colors.text }]}>{item.ponto}</Text>
                        {!!(item.sigla || item.ov) && (
                          <Text style={styles.pontoCellSub}>
                            {[item.sigla, item.ov && `OV ${item.ov}`].filter(Boolean).join(' · ')}
                          </Text>
                        )}
                      </View>
                      <View style={[{ flex: 3 }, styles.pontoOpcoes]}>
                        {['Sim', 'Parcial', 'Não'].map(op => {
                          const ativo = item.executado === op;
                          return (
                            <TouchableOpacity
                              key={op}
                              style={[styles.pontoOpBtn,
                                { borderColor: colors.border, backgroundColor: colors.inputBg },
                                ativo && { backgroundColor: colors.cardDoneLeft, borderColor: colors.cardDoneLeft }]}
                              onPress={() => {
                                setPontosExecucao(prev => prev.map((p, i) =>
                                  i === idx ? { ...p, executado: op, restricao: op === 'Sim' ? '' : p.restricao, responsabilidade: op === 'Sim' ? '' : p.responsabilidade, observacao: op === 'Sim' ? '' : p.observacao } : p
                                ));
                              }}
                            >
                              <Text style={[styles.pontoOpBtnText,
                                { color: colors.text },
                                ativo && { color: '#0F1A0A', fontWeight: '800' }]}>
                                {op}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {precisaJustificativa && (
                      <View style={[styles.pontoExpandido, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                        <Text style={[styles.pontoExpandidoLabel, { color: colors.fieldLabel ?? '#6B7280' }]}>Responsabilidade Execução</Text>
                        <View style={styles.pontoOpcoes}>
                          {['EDP', 'Parceira', 'Terceiro'].map(op => (
                            <TouchableOpacity
                              key={op}
                              style={[styles.pontoOpBtn, item.responsabilidade === op && styles.pontoOpBtnAtivo]}
                              onPress={() => setPontosExecucao(prev => prev.map((p, i) => i === idx ? { ...p, responsabilidade: op } : p))}
                            >
                              <Text style={[styles.pontoOpBtnText, item.responsabilidade === op && styles.pontoOpBtnTextAtivo]}>{op}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={[styles.pontoExpandidoLabel, { color: colors.fieldLabel ?? '#6B7280', marginTop: 8 }]}>Restrição de Execução</Text>
                        <TouchableOpacity
                          style={[styles.pontoPickerBtn, { borderColor: !item.restricao ? '#EF4444' : colors.border, backgroundColor: colors.card }]}
                          onPress={() => setRestricaoPickerIdx(idx)}
                        >
                          <Text style={[styles.pontoPickerBtnText, { color: item.restricao ? colors.text : '#EF4444' }]} numberOfLines={1}>
                            {item.restricao || 'Selecionar (obrigatório)'}
                          </Text>
                          <Text style={{ color: colors.textMuted, fontSize: 12 }}>▼</Text>
                        </TouchableOpacity>

                        <Text style={[styles.pontoExpandidoLabel, { color: colors.fieldLabel ?? '#6B7280', marginTop: 8 }]}>Observação da Execução</Text>
                        <TextInput
                          style={[styles.pontoJustInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText }]}
                          value={item.observacao}
                          onChangeText={v => setPontosExecucao(prev => prev.map((p, i) => i === idx ? { ...p, observacao: v } : p))}
                          placeholder="Observação..."
                          placeholderTextColor={colors.textMuted}
                          multiline
                          textAlignVertical="top"
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </>
          )}

          {/* ── CHECKLIST (apenas DP) ── */}
          <View style={{ marginTop: 8 }} />
          {CHECKLISTS.map(c => {
            const feito = checklistsFeitos[c.id];
            const na = checklistsNA[c.id];
            return (
              <View
                key={c.id}
                style={[styles.checkRow,
                  { backgroundColor: feito ? colors.checkRowDone : na ? '#FFF8E1' : colors.checkRow,
                    borderColor: feito ? colors.checkRowDoneBorder : na ? '#FCD34D' : colors.checkRowBorder }]}
              >
                <TouchableOpacity
                  style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 }}
                  onPress={() => { if (!na) setModalChecklistAberto(c.id); }}
                  activeOpacity={0.7}
                  disabled={na}
                >
                  <View style={[styles.checkbox,
                    !feito && !na && { backgroundColor: colors.inputBg, borderColor: colors.border },
                    feito && styles.checkboxDone,
                    na && { backgroundColor: '#64748B', borderColor: '#64748B' }]}>
                    {feito
                      ? <Text style={styles.checkmark}>✓</Text>
                      : na
                        ? <Text style={styles.checkmark}>—</Text>
                        : null
                    }
                  </View>
                  <Text style={[styles.checkLabel, { color: colors.text },
                    feito && styles.checkLabelDone,
                    na && { color: '#64748B' }]}>
                    {c.nome}
                  </Text>
                </TouchableOpacity>

                {feito && <Text style={styles.doneText}>Concluído</Text>}
                {na && (
                  <TouchableOpacity
                    style={[styles.naBtn, { flexDirection: 'row', gap: 4 }]}
                    onPress={() => setChecklistsNA(prev => ({ ...prev, [c.id]: false }))}
                  >
                    <Text style={styles.naBtnText}>N/A</Text>
                    <Text style={[styles.naBtnText, { fontSize: 12 }]}>✕</Text>
                  </TouchableOpacity>
                )}
                {!feito && !na && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity onPress={() => setModalChecklistAberto(c.id)}>
                      <Text style={[styles.abrirText, { color: colors.linkText }]}>Abrir →</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.naBtn}
                      onPress={() => setChecklistsNA(prev => ({ ...prev, [c.id]: true }))}
                    >
                      <Text style={styles.naBtnText}>N/A</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* ── AS BUILD ── */}
          <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>AS BUILD</Text>
          <Text style={[styles.execPergunta, { color: colors.text }]}>Houveram alterações na execução conforme era o projeto?</Text>
          <View style={styles.execToggleRow}>
            {['Sim', 'Não'].map(op => (
              <TouchableOpacity
                key={op}
                style={styles.execCheckOpcao}
                onPress={() => setAlteracaoExecucao(op)}
              >
                <View style={[styles.execCheckBox, !(alteracaoExecucao === op) && { backgroundColor: colors.inputBg, borderColor: colors.border }, alteracaoExecucao === op && styles.execCheckBoxAtivo]}>
                  {alteracaoExecucao === op && <Text style={styles.execCheckMark}>✓</Text>}
                </View>
                <Text style={[styles.execCheckLabel, { color: colors.text }]}>{op}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {alteracaoExecucao === 'Sim' && (
            <>
              <Text style={[styles.execPergunta, { color: colors.text }]}>Justifique as alterações</Text>
              <TextInput
                style={[styles.execTextArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                value={justificativaAlteracao}
                onChangeText={setJustificativaAlteracao}
                placeholder="Descreva as alterações em relação ao projeto..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </>
          )}
          <Text style={[styles.execPergunta, { color: colors.text }]}>Observações gerais</Text>
          <TextInput
            style={[styles.execTextArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
            value={observacoesGerais}
            onChangeText={setObservacoesGerais}
            placeholder="Digite aqui..."
            placeholderTextColor="#9CA3AF"
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />

          {/* AS BUILD fotos */}
          {fotos.map((uri, i) => {
            const info = AS_BUILD_LABELS[i] ?? { label: `Foto ${i + 1}`, obrigatoria: false };
            return (
              <View key={i} style={[styles.asBuildItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.asBuildInfo}>
                  {uri
                    ? <Image source={{ uri }} style={styles.asBuildThumb} />
                    : <View style={[styles.asBuildThumbVazio, { backgroundColor: colors.asBuildThumbVazio }]} />
                  }
                  <View style={styles.asBuildTexto}>
                    <Text style={[styles.asBuildLabel, { color: colors.text }]}>{info.label}</Text>
                    {info.obrigatoria && !uri
                      ? <Text style={styles.asBuildObrig}>Obrigatória</Text>
                      : uri
                        ? <Text style={styles.asBuildOk}>✓ Adicionada</Text>
                        : null
                    }
                  </View>
                </View>
                {uri ? (
                  <TouchableOpacity style={styles.asBuildRemove} onPress={() => removerFoto(i)}>
                    <Text style={styles.asBuildRemoveText}>✕</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={styles.asBuildBtns}>
                    <TouchableOpacity
                      style={[styles.asBuildBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      onPress={() => tirarFoto(i)}
                    >
                      <Text style={[styles.asBuildBtnText, { color: colors.textSub }]}>Câmera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.asBuildBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                      onPress={() => anexarFoto(i)}
                    >
                      <Text style={[styles.asBuildBtnText, { color: colors.textSub }]}>Galeria</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          <TouchableOpacity
            style={[styles.enviarBtn, !podeEnviar && styles.btnDisabled]}
            onPress={handleEnviar}
            activeOpacity={0.85}
          >
            <Text style={styles.enviarBtnText}>Enviar Questionário</Text>
          </TouchableOpacity>
          {!podeEnviar && (
            <Text style={styles.hint}>
              Complete o checklist DP e as 2 fotos obrigatórias do AS BUILD para enviar.
            </Text>
          )}
        </View>
      </ScrollView>

      {/* Modal DP */}
      <DPModal
        visible={modalChecklistAberto === 3}
        onClose={() => setModalChecklistAberto(null)}
        onConcluir={dados => {
          setDadosFichas(prev => ({ ...prev, 3: dados }));
          setChecklistsFeitos(prev => ({ ...prev, 3: true }));
        }}
        obra={primeiraObra}
      />

      {/* ── MODAL RESTRIÇÃO DE EXECUÇÃO ── */}
      <Modal
        visible={restricaoPickerIdx !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRestricaoPickerIdx(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.pausaCard, { backgroundColor: colors.card, maxHeight: '80%', flexDirection: 'column', paddingBottom: 32 }]}>
            <Text style={[styles.pausaTitle, { color: colors.heading }]}>Restrição de Execução</Text>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 4 }}>
              {RESTRICOES_EXECUCAO.map(op => {
                const sel = pontosExecucao[restricaoPickerIdx]?.restricao === op;
                return (
                  <TouchableOpacity
                    key={op}
                    style={[styles.restricaoItem,
                      { borderColor: sel ? colors.cardDoneLeft : colors.border,
                        backgroundColor: sel ? colors.tagDoneBg : 'transparent' }]}
                    onPress={() => {
                      setPontosExecucao(prev => prev.map((p, i) =>
                        i === restricaoPickerIdx ? { ...p, restricao: op } : p
                      ));
                      setRestricaoPickerIdx(null);
                    }}
                  >
                    <Text style={[styles.restricaoItemText, { color: sel ? colors.cardDoneLeft : colors.text },
                      sel && { fontWeight: '800' }]}>
                      {op}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
            <TouchableOpacity
              style={{ marginTop: 12, height: 44, borderRadius: 10, borderWidth: 1.5, borderColor: colors.border, justifyContent: 'center', alignItems: 'center' }}
              onPress={() => setRestricaoPickerIdx(null)}
            >
              <Text style={[styles.pausaCancelText, { color: colors.textSub }]}>Cancelar</Text>
            </TouchableOpacity>
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

  body: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#374151',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6,
  },

  pontosHeader: {
    flexDirection: 'row', backgroundColor: '#1E3A5F', borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 4, marginTop: 10, gap: 4,
  },
  pontoHeaderCell: {
    fontSize: 11, fontWeight: '800', color: '#FFF',
    textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center',
  },
  pontoRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 8, paddingHorizontal: 4, gap: 4,
  },
  pontoCellPonto: {
    fontSize: 14, fontWeight: '800', color: '#1E3A5F',
    textAlign: 'center', paddingTop: 4,
  },
  pontoCellSub: { fontSize: 10, color: '#9CA3AF', textAlign: 'center', marginTop: 2 },
  pontoOpcoes: { flexDirection: 'row', gap: 4, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' },
  pontoOpBtn: {
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6,
    borderWidth: 1.5, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB',
    alignItems: 'center',
  },
  pontoOpBtnAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  pontoOpBtnText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  pontoOpBtnTextAtivo: { color: '#FFF' },
  pontoJustInput: {
    borderWidth: 1.5, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 6,
    fontSize: 12, minHeight: 60,
  },
  pontoExpandido: {
    borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 6, marginTop: 2,
  },
  pontoExpandidoLabel: {
    fontSize: 11, fontWeight: '700', textTransform: 'uppercase',
    letterSpacing: 0.3, marginBottom: 4,
  },
  pontoPickerBtn: {
    borderWidth: 1.5, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 9,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  pontoPickerBtnText: { fontSize: 13, flex: 1, marginRight: 6 },
  restricaoItem: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 11,
    paddingHorizontal: 14, marginBottom: 6,
  },
  restricaoItemText: { fontSize: 14, color: '#374151' },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8,
  },
  checkbox: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  checkmark: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  checkLabel: { flex: 1, fontSize: 14, color: '#111827', fontWeight: '500' },
  checkLabelDone: { color: '#16A34A' },
  doneText: { fontSize: 12, color: '#16A34A', fontWeight: '700' },
  abrirText: { fontSize: 12, color: '#3B82F6', fontWeight: '700' },
  naBtn: {
    backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#CBD5E1',
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
  },
  naBtnText: { fontSize: 11, fontWeight: '700', color: '#64748B' },

  execPergunta: { fontSize: 13, fontWeight: '600', color: '#111827', marginTop: 8, marginBottom: 6 },
  execToggleRow: { flexDirection: 'row', gap: 20, marginBottom: 10 },
  execCheckOpcao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  execCheckBox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 2, borderColor: '#D1D5DB', backgroundColor: '#FFF',
    justifyContent: 'center', alignItems: 'center',
  },
  execCheckBoxAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  execCheckMark: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  execCheckLabel: { fontSize: 13, color: '#374151' },
  execTextArea: {
    borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 13, color: '#111827', backgroundColor: '#F9FAFB',
    minHeight: 80, marginBottom: 4,
  },

  asBuildItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  asBuildInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  asBuildThumb: { width: 48, height: 48, borderRadius: 8 },
  asBuildThumbVazio: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: '#E5E7EB',
  },
  asBuildTexto: { flex: 1 },
  asBuildLabel: { fontSize: 13, fontWeight: '600', color: '#111827' },
  asBuildObrig: { fontSize: 11, color: '#F59E0B', fontWeight: '600', marginTop: 2 },
  asBuildOk: { fontSize: 11, color: '#16A34A', fontWeight: '600', marginTop: 2 },
  asBuildRemove: {
    backgroundColor: '#FEE2E2', borderRadius: 8,
    width: 32, height: 32, justifyContent: 'center', alignItems: 'center',
  },
  asBuildRemoveText: { color: '#EF4444', fontSize: 13, fontWeight: '800' },
  asBuildBtns: { flexDirection: 'row', gap: 6 },
  asBuildBtn: {
    backgroundColor: '#F1F5F9', borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0',
    paddingHorizontal: 10, height: 36, justifyContent: 'center', alignItems: 'center',
  },
  asBuildBtnText: { fontSize: 11, fontWeight: '700', color: '#475569' },

  enviarBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 24, elevation: 3,
  },
  btnDisabled: { backgroundColor: '#D1D5DB', elevation: 0 },
  enviarBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  hint: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 6 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pausaCard: {
    backgroundColor: '#FFF', borderRadius: 20, padding: 24,
    width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  pausaTitle: { fontSize: 16, fontWeight: '800', color: '#1E3A5F', marginBottom: 6 },
  pausaCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
});
