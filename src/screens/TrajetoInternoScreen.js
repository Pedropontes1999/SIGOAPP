import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, Modal,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

// Opções fixas de motivo de pausa (mesmas do fluxo do parceiro)
const MOTIVOS_PAUSA = [
  'Almoço/Café',
  'Carregar caminhão',
  'Mudança de equipe',
  'Aguardando material',
];

// Formata segundos em HH:MM:SS
function fmt(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${h}:${m}:${ss}`;
}

function horaStr(date) {
  return date ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—';
}

export default function TrajetoInternoScreen({ route, navigation }) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();

  const equipes = route?.params?.equipes ?? [];
  const projeto = route?.params?.projeto ?? null;

  const [inicio, setInicio]   = useState(null); // Date
  const [fim, setFim]         = useState(null); // Date
  const [duracao, setDuracao] = useState(0);    // duração final (descontando pausas)
  const [elapsed, setElapsed] = useState(0);    // segundos decorridos (ao vivo)

  // Pausa — copiado do fluxo do parceiro
  const [showPausaModal, setShowPausaModal] = useState(false);
  const [motivoPausa, setMotivoPausa]       = useState('');
  const [pausaAtual, setPausaAtual]         = useState(null); // { inicio: Date, motivo }
  const [pausas, setPausas]                 = useState([]);   // [{ inicio, fim, motivo }]

  const intervalRef = useRef(null);

  const emAndamento = inicio && !fim;
  const finalizado  = inicio && fim;

  // Encerra a pausa ativa (se houver), registrando-a no histórico — igual ao parceiro
  function encerrarPausaAtiva() {
    if (pausaAtual) {
      setPausas(prev => [...prev, { ...pausaAtual, fim: new Date() }]);
      setPausaAtual(null);
    }
  }

  // Timer ao vivo enquanto o trajeto está em andamento.
  // Pausas só ocorrem nos pontos de descanso (antes de iniciar e após finalizar),
  // nunca durante o trajeto — então a duração é simplesmente início → fim, igual ao parceiro.
  useEffect(() => {
    if (emAndamento) {
      const tick = () => setElapsed((Date.now() - inicio.getTime()) / 1000);
      tick();
      intervalRef.current = setInterval(tick, 1000);
      return () => clearInterval(intervalRef.current);
    }
  }, [inicio, fim]);

  // Iniciar fecha a pausa ativa (se houver), igual ao botão "Iniciar" do parceiro
  function iniciarTrajeto() {
    encerrarPausaAtiva();
    setInicio(new Date());
    setFim(null);
    setDuracao(0);
    setElapsed(0);
  }

  function finalizarTrajeto() {
    setDuracao((Date.now() - inicio.getTime()) / 1000);
    setFim(new Date());
  }

  function confirmarPausa() {
    if (!motivoPausa.trim()) return;
    setPausaAtual({ inicio: new Date(), motivo: motivoPausa.trim() });
    setShowPausaModal(false);
  }

  function iniciarAtividade() {
    encerrarPausaAtiva();
    navigation.navigate('EquipesFiscalizacao', {
      equipes,
      projeto,
      trajeto: inicio && fim ? { inicio: inicio.toISOString(), fim: fim.toISOString() } : null,
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
          <Text style={styles.headerTitle}>Trajeto</Text>
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

      <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}>
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.heading }]}>Deslocamento até a obra</Text>
          {equipes.length > 0 && (
            <Text style={[styles.cardSub, { color: colors.equipeSub }]}>
              {equipes.length} equipe{equipes.length > 1 ? 's' : ''} para fiscalizar
            </Text>
          )}

          {/* Cronômetro */}
          <View style={styles.timerBox}>
            <Text style={[styles.timer, { color: colors.heading }]}>
              {finalizado ? fmt(duracao) : fmt(elapsed)}
            </Text>
            <Text style={[styles.timerLabel, { color: colors.equipeSub }]}>
              {finalizado ? 'Duração do trajeto' : pausaAtual ? 'Em pausa' : emAndamento ? 'Em andamento...' : 'Trajeto não iniciado'}
            </Text>
          </View>

          {/* Horários registrados */}
          <View style={styles.horaRow}>
            <View style={styles.horaItem}>
              <Feather name="play-circle" size={14} color="#16A34A" />
              <Text style={[styles.horaText, { color: colors.equipeNome }]}>Início: {horaStr(inicio)}</Text>
            </View>
            <View style={styles.horaItem}>
              <Feather name="stop-circle" size={14} color="#DC2626" />
              <Text style={[styles.horaText, { color: colors.equipeNome }]}>Fim: {horaStr(fim)}</Text>
            </View>
          </View>

          {/* Banner de pausa ativa */}
          {pausaAtual && (
            <View style={styles.pausaAtivaBox}>
              <Text style={styles.pausaAtivaLabel}>Em pausa desde {horaStr(pausaAtual.inicio)}</Text>
              <Text style={styles.pausaAtivaMotivo}>"{pausaAtual.motivo}"</Text>
            </View>
          )}

          {/* Ações — pausa só aparece nos pontos de descanso, igual ao parceiro:
              antes de iniciar o trajeto e após finalizá-lo (nunca durante o trajeto) */}
          {!inicio && (
            <View style={styles.btnRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.pauseBtn, pausaAtual && styles.pauseBtnAtiva]}
                onPress={() => { setMotivoPausa(''); setShowPausaModal(true); }}
                disabled={!!pausaAtual}
                activeOpacity={0.85}
              >
                <Feather name="pause" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>{pausaAtual ? 'Em pausa' : 'Pausa'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.actionBtn, styles.startBtn, { flex: 1 }]} onPress={iniciarTrajeto} activeOpacity={0.85}>
                <Feather name="navigation" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>Iniciar Trajeto</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Em andamento: só finalizar — sem pausa durante o trajeto, igual ao parceiro */}
          {emAndamento && (
            <TouchableOpacity style={[styles.actionBtn, styles.stopBtn]} onPress={finalizarTrajeto} activeOpacity={0.85}>
              <Feather name="flag" size={18} color="#FFF" />
              <Text style={styles.actionBtnText}>Finalizar Trajeto</Text>
            </TouchableOpacity>
          )}

          {/* Finalizado: selo + pausa (encerrada automaticamente ao iniciar a atividade) */}
          {finalizado && (
            <>
              <View style={styles.doneBadge}>
                <Feather name="check-circle" size={16} color="#16A34A" />
                <Text style={styles.doneBadgeText}>Trajeto finalizado</Text>
              </View>
              <TouchableOpacity
                style={[styles.actionBtn, styles.pauseBtn, pausaAtual && styles.pauseBtnAtiva, { marginTop: 10 }]}
                onPress={() => { setMotivoPausa(''); setShowPausaModal(true); }}
                disabled={!!pausaAtual}
                activeOpacity={0.85}
              >
                <Feather name="pause" size={18} color="#FFF" />
                <Text style={styles.actionBtnText}>{pausaAtual ? 'Em pausa' : 'Pausa'}</Text>
              </TouchableOpacity>
            </>
          )}

          {/* Histórico de pausas */}
          {pausas.map((p, i) => {
            const dur = (p.fim.getTime() - p.inicio.getTime()) / 1000;
            return (
              <View key={i} style={styles.pausaRegistro}>
                <View style={styles.pausaRegistroHeader}>
                  <Text style={styles.pausaRegistroBadge}>⏸ Pausa</Text>
                  <Text style={styles.pausaRegistroDuracao}>{fmt(dur)}</Text>
                </View>
                <Text style={styles.pausaRegistroTempos}>
                  {horaStr(p.inicio)} – {horaStr(p.fim)}
                </Text>
                <Text style={styles.pausaRegistroMotivo}>"{p.motivo}"</Text>
              </View>
            );
          })}
        </View>
      </ScrollView>

      {/* Iniciar atividade libera só após finalizar o trajeto e sem pausa ativa */}
      <View style={[styles.footer, { backgroundColor: colors.footerBg, borderTopColor: colors.footerBorder }]}>
        <TouchableOpacity
          style={[styles.footerBtn, !finalizado && styles.footerBtnDisabled]}
          onPress={iniciarAtividade}
          disabled={!finalizado}
          activeOpacity={0.85}
        >
          <Text style={styles.footerBtnText}>Iniciar Atividade</Text>
        </TouchableOpacity>
      </View>

      {/* Modal de motivo da pausa */}
      <Modal visible={showPausaModal} transparent animationType="fade" onRequestClose={() => setShowPausaModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.pausaCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.pausaTitle, { color: colors.heading }]}>Motivo da Pausa</Text>
            <Text style={[styles.pausaSub, { color: colors.textSub }]}>Selecione o motivo da pausa.</Text>
            <View style={styles.motivosWrap}>
              {MOTIVOS_PAUSA.map(motivo => {
                const ativo = motivoPausa === motivo;
                return (
                  <TouchableOpacity
                    key={motivo}
                    style={[styles.motivoChip,
                      { backgroundColor: colors.inputBg, borderColor: colors.border },
                      ativo && styles.motivoChipAtivo]}
                    onPress={() => setMotivoPausa(motivo)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.motivoChipText, { color: colors.text }, ativo && styles.motivoChipTextAtivo]}>
                      {motivo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.pausaActions}>
              <TouchableOpacity style={[styles.pausaCancelBtn, { borderColor: colors.border }]} onPress={() => setShowPausaModal(false)} activeOpacity={0.8}>
                <Text style={[styles.pausaCancelText, { color: colors.textSub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.pausaConfirmBtn, !motivoPausa.trim() && styles.footerBtnDisabled]} onPress={confirmarPausa} disabled={!motivoPausa.trim()} activeOpacity={0.8}>
                <Text style={styles.pausaConfirmText}>Confirmar Pausa</Text>
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
  headerTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  headerSub: { fontSize: 12, color: '#93C5FD', marginTop: 1 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  body: { flexGrow: 1, padding: 16 },
  card: {
    borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 16, fontWeight: '800' },
  cardSub: { fontSize: 12, marginTop: 2 },

  timerBox: { alignItems: 'center', marginVertical: 24 },
  timer: { fontSize: 44, fontWeight: '900', letterSpacing: 2, fontVariant: ['tabular-nums'] },
  timerLabel: { fontSize: 12, marginTop: 4, fontWeight: '600' },

  horaRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 20 },
  horaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  horaText: { fontSize: 13, fontWeight: '600' },

  btnRow: { flexDirection: 'row', gap: 10 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderRadius: 12, paddingVertical: 15, paddingHorizontal: 16,
  },
  startBtn: { backgroundColor: '#16A34A' },
  stopBtn: { backgroundColor: '#DC2626' },
  pauseBtn: { backgroundColor: '#475569' },
  pauseBtnAtiva: { backgroundColor: '#64748B', opacity: 0.6 },
  actionBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  doneBadge: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: '#F0FDF4', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: '#BBF7D0',
  },
  doneBadgeText: { color: '#15803D', fontSize: 14, fontWeight: '700' },

  pausaAtivaBox: {
    backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 14,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  pausaAtivaLabel: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  pausaAtivaMotivo: { fontSize: 12, color: '#B45309', marginTop: 2, fontStyle: 'italic' },

  pausaRegistro: {
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, marginTop: 12,
    borderWidth: 1, borderColor: '#F3F4F6',
  },
  pausaRegistroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pausaRegistroBadge: { fontSize: 12, fontWeight: '700', color: '#374151' },
  pausaRegistroDuracao: { fontSize: 12, fontWeight: '800', color: '#1E3A5F' },
  pausaRegistroTempos: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  pausaRegistroMotivo: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },

  footer: {
    paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1,
  },
  footerBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center',
  },
  footerBtnDisabled: { backgroundColor: '#D1D5DB' },
  footerBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },

  // Modal de pausa
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  pausaCard: {
    borderRadius: 20, padding: 24, width: '100%', maxWidth: 480,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  pausaTitle: { fontSize: 16, fontWeight: '800', marginBottom: 6 },
  pausaSub: { fontSize: 13, marginBottom: 16 },
  motivosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  motivoChip: { borderWidth: 1.5, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  motivoChipAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  motivoChipText: { fontSize: 13, fontWeight: '600' },
  motivoChipTextAtivo: { color: '#FFF', fontWeight: '800' },
  pausaActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  pausaCancelBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, borderWidth: 1.5, alignItems: 'center' },
  pausaCancelText: { fontSize: 14, fontWeight: '600' },
  pausaConfirmBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#1E3A5F', alignItems: 'center' },
  pausaConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
