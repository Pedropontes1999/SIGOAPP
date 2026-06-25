import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { getSupervisoresParaParceiras } from '../data/supervisores';
import { getTecnicosParaParceiras } from '../data/tecnicosSeguranca';

export default function EquipesFiscalizacaoScreen({ route, navigation }) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();

  const equipes = route?.params?.equipes ?? [];
  const projeto = route?.params?.projeto ?? null;
  const trajeto = route?.params?.trajeto ?? null;

  // Conferência por equipe: { [sigla]: { ausente: bool, presencas: { [membroId]: presente } } }
  const [conferencias, setConferencias] = useState({});

  // Supervisores de campo presentes na obra (vários permitidos)
  const [supervisores, setSupervisores] = useState([]); // [{ nome, empresa }]
  const [supervisorAusente, setSupervisorAusente] = useState(false); // nenhum supervisor na obra
  const [modalSupervisor, setModalSupervisor] = useState(false);
  const gruposSupervisores = getSupervisoresParaParceiras(equipes.map(e => e.parceira));

  function toggleSupervisor(s) {
    setSupervisorAusente(false); // selecionar um supervisor cancela o "ausente"
    setSupervisores(prev =>
      prev.some(x => x.nome === s.nome)
        ? prev.filter(x => x.nome !== s.nome)
        : [...prev, s]
    );
  }

  // Marca que não havia supervisor na obra (limpa os selecionados)
  function toggleSupervisorAusente() {
    setSupervisorAusente(prev => {
      const next = !prev;
      if (next) setSupervisores([]);
      return next;
    });
  }

  // Técnicos de segurança presentes na obra (mesmo funcionamento do supervisor)
  const [tecnicos, setTecnicos] = useState([]); // [{ nome, empresa }]
  const [tecnicoAusente, setTecnicoAusente] = useState(false);
  const [modalTecnico, setModalTecnico] = useState(false);
  const gruposTecnicos = getTecnicosParaParceiras(equipes.map(e => e.parceira));

  function toggleTecnico(t) {
    setTecnicoAusente(false);
    setTecnicos(prev =>
      prev.some(x => x.nome === t.nome)
        ? prev.filter(x => x.nome !== t.nome)
        : [...prev, t]
    );
  }

  function toggleTecnicoAusente() {
    setTecnicoAusente(prev => {
      const next = !prev;
      if (next) setTecnicos([]);
      return next;
    });
  }

  function registrarConferencia(sigla, presencas, extras = []) {
    setConferencias(prev => ({ ...prev, [sigla]: { ausente: false, presencas, extras } }));
  }

  // Marca a equipe inteira como ausente (não foi à obra)
  function marcarEquipeAusente(sigla) {
    setConferencias(prev => ({ ...prev, [sigla]: { ausente: true, presencas: {} } }));
  }

  const total  = equipes.length;
  const feitas = equipes.filter(e => conferencias[e.sigla]).length;
  const todasFeitas = total > 0 && feitas === total;
  // Supervisor precisa estar definido: ao menos um presente OU marcado como ausente
  const supervisorDefinido = supervisores.length > 0 || supervisorAusente;
  const tecnicoDefinido = tecnicos.length > 0 || tecnicoAusente;
  const podeAvancar = todasFeitas && supervisorDefinido && tecnicoDefinido;

  // Abre a conferência da equipe; ao confirmar, marca como conferida aqui
  function abrirEquipe(equipe) {
    navigation.navigate('ConfirmacaoEquipe', {
      equipe,
      presencas: conferencias[equipe.sigla]?.presencas,
      extras: conferencias[equipe.sigla]?.extras,
      onConfirmar: (presencas, extras) => registrarConferencia(equipe.sigla, presencas, extras),
    });
  }

  // Resumo de presentes a partir do map salvo
  function resumoPresenca(sigla) {
    const p = conferencias[sigla]?.presencas;
    if (!p) return null;
    const ids = Object.keys(p);
    return { presentes: ids.filter(id => p[id]).length, total: ids.length };
  }

  function avancar() {
    navigation.navigate('QuestionarioInterno', {
      equipes,
      projeto,
      trajeto,
      conferencias,
      supervisores,
      supervisorAusente,
      tecnicos,
      tecnicoAusente,
    });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Conferência de equipes</Text>
          <Text style={styles.headerSub}>{feitas} de {total} conferidas</Text>
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

      <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}>
        <Text style={[styles.hint, { color: colors.equipeSub }]}>
          Toque na equipe para confirmar quem está na obra, ou marque "Ausente" se ela não compareceu.
        </Text>

        {equipes.map(e => {
          const conf = conferencias[e.sigla];
          const done = !!conf;
          const ausente = conf?.ausente;
          const resumo = resumoPresenca(e.sigla);
          return (
            <TouchableOpacity
              key={e.sigla}
              style={[
                styles.equipeCard,
                { backgroundColor: colors.card, borderColor: colors.border },
                done && !ausente && styles.equipeCardDone,
                ausente && styles.equipeCardAusente,
              ]}
              onPress={() => abrirEquipe(e)}
              activeOpacity={0.8}
            >
              <View style={[
                styles.siglaBadge,
                { backgroundColor: colors.chipBg },
                done && !ausente && styles.siglaBadgeDone,
                ausente && styles.siglaBadgeAusente,
              ]}>
                <Text style={[
                  styles.siglaText,
                  { color: colors.heading },
                  (done) && styles.siglaTextOnColor,
                ]}>{e.sigla}</Text>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={[
                  styles.parceira,
                  { color: colors.heading },
                  done && !ausente && styles.parceiraDone,
                  ausente && styles.parceiraAusente,
                ]}>
                  {e.parceira || 'Parceira não identificada'}
                </Text>
                <Text style={[styles.sub, { color: colors.equipeSub }]}>
                  {[e.tipoEquipe, e.composicao].filter(Boolean).join(' · ') || '—'}
                </Text>
              </View>

              {/* Estado à direita: conferida / ausente / ações */}
              {ausente ? (
                <View style={styles.ausenteTag}>
                  <Feather name="user-x" size={13} color="#FFF" />
                  <Text style={styles.ausenteTagText}>Ausente</Text>
                </View>
              ) : done ? (
                <View style={styles.doneTag}>
                  <Feather name="check" size={13} color="#FFF" />
                  <Text style={styles.doneTagText}>
                    {resumo ? `${resumo.presentes}/${resumo.total}` : 'OK'}
                  </Text>
                </View>
              ) : (
                <View style={styles.rightActions}>
                  <TouchableOpacity
                    style={styles.faltouBtn}
                    onPress={() => marcarEquipeAusente(e.sigla)}
                    activeOpacity={0.8}
                  >
                    <Feather name="user-x" size={13} color="#DC2626" />
                    <Text style={styles.faltouBtnText}>Ausente</Text>
                  </TouchableOpacity>
                  <Feather name="chevron-right" size={20} color="#9CA3AF" />
                </View>
              )}
            </TouchableOpacity>
          );
        })}

        {/* Supervisor de campo presente na obra (pode adicionar vários ou marcar ausente) */}
        <View style={[
          styles.supCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          supervisorAusente && styles.supCardAusente,
        ]}>
          <View style={styles.supHeader}>
            <Text style={[styles.supTitle, { color: colors.heading }]}>Supervisor</Text>
            <View style={styles.supHeaderActions}>
              <TouchableOpacity
                style={[styles.supAusenteBtn, supervisorAusente && styles.supAusenteBtnAtivo]}
                onPress={toggleSupervisorAusente}
                activeOpacity={0.8}
              >
                <Feather name="user-x" size={13} color={supervisorAusente ? '#FFF' : '#DC2626'} />
                <Text style={[styles.supAusenteBtnText, supervisorAusente && styles.supAusenteBtnTextAtivo]}>Ausente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.supAddBtn} onPress={() => setModalSupervisor(true)} activeOpacity={0.8}>
                <Feather name="plus" size={18} color="#1E3A5F" />
              </TouchableOpacity>
            </View>
          </View>

          {supervisorAusente ? (
            <Text style={[styles.supEmpty, { color: '#B91C1C' }]}>
              Nenhum supervisor presente na obra.
            </Text>
          ) : supervisores.length === 0 ? (
            <Text style={[styles.supEmpty, { color: colors.equipeSub }]}>
              Toque em + para adicionar o(s) supervisor(es) presente(s) na obra, ou marque "Ausente".
            </Text>
          ) : (
            <View style={styles.supChips}>
              {supervisores.map(s => (
                <View key={s.nome} style={styles.supChip}>
                  <Text style={styles.supChipText} numberOfLines={1}>{s.nome}</Text>
                  <TouchableOpacity onPress={() => toggleSupervisor(s)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color="#1E3A5F" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Técnico de segurança presente na obra (mesmo funcionamento do supervisor) */}
        <View style={[
          styles.supCard,
          { backgroundColor: colors.card, borderColor: colors.border },
          tecnicoAusente && styles.supCardAusente,
        ]}>
          <View style={styles.supHeader}>
            <Text style={[styles.supTitle, { color: colors.heading }]}>Técnico de segurança</Text>
            <View style={styles.supHeaderActions}>
              <TouchableOpacity
                style={[styles.supAusenteBtn, tecnicoAusente && styles.supAusenteBtnAtivo]}
                onPress={toggleTecnicoAusente}
                activeOpacity={0.8}
              >
                <Feather name="user-x" size={13} color={tecnicoAusente ? '#FFF' : '#DC2626'} />
                <Text style={[styles.supAusenteBtnText, tecnicoAusente && styles.supAusenteBtnTextAtivo]}>Ausente</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.supAddBtn} onPress={() => setModalTecnico(true)} activeOpacity={0.8}>
                <Feather name="plus" size={18} color="#1E3A5F" />
              </TouchableOpacity>
            </View>
          </View>

          {tecnicoAusente ? (
            <Text style={[styles.supEmpty, { color: '#B91C1C' }]}>
              Nenhum técnico de segurança presente na obra.
            </Text>
          ) : tecnicos.length === 0 ? (
            <Text style={[styles.supEmpty, { color: colors.equipeSub }]}>
              Toque em + para adicionar o(s) técnico(s) de segurança presente(s) na obra, ou marque "Ausente".
            </Text>
          ) : (
            <View style={styles.supChips}>
              {tecnicos.map(t => (
                <View key={t.nome} style={styles.supChip}>
                  <Text style={styles.supChipText} numberOfLines={1}>{t.nome}</Text>
                  <TouchableOpacity onPress={() => toggleTecnico(t)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Feather name="x" size={14} color="#1E3A5F" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {todasFeitas && (
          <View style={styles.allDoneBox}>
            <Feather name="check-circle" size={18} color="#16A34A" />
            <Text style={styles.allDoneText}>Todas as equipes foram conferidas!</Text>
          </View>
        )}
      </ScrollView>

      {/* Avançar só libera com todas as equipes conferidas E o supervisor definido */}
      <View style={[styles.footer, { backgroundColor: colors.footerBg, borderTopColor: colors.footerBorder }]}>
        <TouchableOpacity
          style={[styles.footerBtn, !podeAvancar && styles.footerBtnDisabled]}
          onPress={avancar}
          disabled={!podeAvancar}
          activeOpacity={0.85}
        >
          <Text style={styles.footerBtnText}>
            {!todasFeitas
              ? `Conferir todas (${feitas}/${total})`
              : !supervisorDefinido
                ? 'Informe o supervisor'
                : !tecnicoDefinido
                  ? 'Informe o técnico de segurança'
                  : 'Avançar'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Modal: seleção de supervisores presentes na obra */}
      <Modal
        visible={modalSupervisor}
        transparent
        animationType="slide"
        onRequestClose={() => setModalSupervisor(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.heading }]}>Supervisores presentes</Text>
              <TouchableOpacity onPress={() => setModalSupervisor(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.heading} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {gruposSupervisores.map(grupo => (
                <View key={grupo.empresa}>
                  <Text style={[styles.modalGrupo, { color: colors.equipeSub }]}>{grupo.empresa}</Text>
                  {grupo.supervisores.map(s => {
                    const sel = supervisores.some(x => x.nome === s.nome);
                    return (
                      <TouchableOpacity
                        key={s.nome}
                        style={[styles.modalRow, { borderBottomColor: colors.border }]}
                        onPress={() => toggleSupervisor(s)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                          {sel && <Feather name="check" size={14} color="#FFF" />}
                        </View>
                        <Text style={[styles.modalRowText, { color: colors.text }]} numberOfLines={1}>{s.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalDone} onPress={() => setModalSupervisor(false)} activeOpacity={0.85}>
              <Text style={styles.modalDoneText}>
                Concluir{supervisores.length ? ` (${supervisores.length})` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Modal: seleção de técnicos de segurança presentes na obra */}
      <Modal
        visible={modalTecnico}
        transparent
        animationType="slide"
        onRequestClose={() => setModalTecnico(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.heading }]}>Técnicos de segurança presentes</Text>
              <TouchableOpacity onPress={() => setModalTecnico(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Feather name="x" size={22} color={colors.heading} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingBottom: 8 }}>
              {gruposTecnicos.map(grupo => (
                <View key={grupo.empresa}>
                  <Text style={[styles.modalGrupo, { color: colors.equipeSub }]}>{grupo.empresa}</Text>
                  {grupo.tecnicos.map(t => {
                    const sel = tecnicos.some(x => x.nome === t.nome);
                    return (
                      <TouchableOpacity
                        key={t.nome}
                        style={[styles.modalRow, { borderBottomColor: colors.border }]}
                        onPress={() => toggleTecnico(t)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                          {sel && <Feather name="check" size={14} color="#FFF" />}
                        </View>
                        <Text style={[styles.modalRowText, { color: colors.text }]} numberOfLines={1}>{t.nome}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity style={styles.modalDone} onPress={() => setModalTecnico(false)} activeOpacity={0.85}>
              <Text style={styles.modalDoneText}>
                Concluir{tecnicos.length ? ` (${tecnicos.length})` : ''}
              </Text>
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

  body: { flexGrow: 1, padding: 16, paddingBottom: 100, gap: 10 },
  hint: { fontSize: 12, marginBottom: 2 },

  equipeCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, padding: 14,
    borderWidth: 1.5,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  equipeCardDone: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  equipeCardAusente: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  siglaBadge: {
    borderRadius: 8, paddingHorizontal: 10,
    paddingVertical: 6, minWidth: 76, alignItems: 'center',
  },
  siglaBadgeDone: { backgroundColor: '#16A34A' },
  siglaBadgeAusente: { backgroundColor: '#DC2626' },
  siglaText: { fontSize: 12, fontWeight: '800' },
  siglaTextOnColor: { color: '#FFF' },
  parceira: { fontSize: 14, fontWeight: '700' },
  parceiraDone: { color: '#15803D' },
  parceiraAusente: { color: '#B91C1C' },
  sub: { fontSize: 11, marginTop: 2 },

  rightActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  faltouBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  faltouBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },

  doneTag: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#16A34A', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  doneTagText: { fontSize: 12, fontWeight: '800', color: '#FFF' },
  ausenteTag: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#DC2626', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4,
  },
  ausenteTagText: { fontSize: 12, fontWeight: '800', color: '#FFF' },

  supCard: {
    borderRadius: 14, padding: 14, borderWidth: 1.5, marginTop: 4,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05, shadowRadius: 6, elevation: 2,
  },
  supCardAusente: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  supHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  supHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  supTitle: { fontSize: 14, fontWeight: '800' },
  supAusenteBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1.5, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6,
  },
  supAusenteBtnAtivo: { backgroundColor: '#DC2626', borderColor: '#DC2626' },
  supAusenteBtnText: { fontSize: 12, fontWeight: '700', color: '#DC2626' },
  supAusenteBtnTextAtivo: { color: '#FFF' },
  supAddBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: '#E8EEF6',
    justifyContent: 'center', alignItems: 'center',
  },
  supEmpty: { fontSize: 12, marginTop: 8 },
  supChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  supChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '100%',
    backgroundColor: '#E8EEF6', borderRadius: 20, paddingLeft: 12, paddingRight: 8, paddingVertical: 6,
  },
  supChipText: { fontSize: 12, fontWeight: '700', color: '#1E3A5F', flexShrink: 1 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  modalCard: {
    borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8,
  },
  modalTitle: { fontSize: 16, fontWeight: '800' },
  modalGrupo: { fontSize: 12, fontWeight: '800', marginTop: 12, marginBottom: 4, textTransform: 'uppercase' },
  modalRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, borderBottomWidth: 1,
  },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxOn: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  modalRowText: { fontSize: 14, fontWeight: '600', flex: 1 },
  modalDone: {
    backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 14,
  },
  modalDoneText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  allDoneBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 16, marginTop: 6,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  allDoneText: { color: '#15803D', fontSize: 14, fontWeight: '700' },

  footer: {
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08, shadowRadius: 8, elevation: 10,
  },
  footerBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  footerBtnDisabled: { backgroundColor: '#D1D5DB' },
  footerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
