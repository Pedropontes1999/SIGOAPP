import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, Image, Alert, Platform,
  Modal, TextInput, KeyboardAvoidingView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Linking } from 'react-native';
import * as XLSX from 'xlsx';
import * as Location from 'expo-location';
import { useAuth } from '../context/AuthContext';
import FichaMedicaoAterramentoModal from '../components/FichaMedicaoAterramentoModal';
import FichaEquipamentoModal from '../components/FichaEquipamentoModal';
import DPModal from '../components/DPModal';
import PDFViewerModal from '../components/PDFViewerModal';
import { saveTrajetoSession, loadTrajetoSession, clearTrajetoSession } from '../storage/session';
import { saveReport } from '../storage/reports';
import { buildWorkbook } from '../storage/buildWorkbook';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

// Mapa de etapas — define o rótulo do header e qual dot fica ativo por stage
const STAGE_INFO = {
  idle:                   { label: 'Deslocamento',   step: 1 },
  deslocando:             { label: 'Deslocamento',   step: 1 },
  deslocamento_fim:       { label: 'Deslocamento',   step: 1 },
  atividade:              { label: 'Atividade',      step: 2 },
  concluido:              { label: 'Atividade',      step: 2 },
  deslocamento_volta:     { label: 'Retorno à Base', step: 3 },
  deslocamento_volta_fim: { label: 'Retorno à Base', step: 3 },
  encerrado:              { label: 'Encerrado',      step: 3 },
};

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

// Os 3 checklists obrigatórios — cada um abre um modal próprio ao ser tocado
const CHECKLISTS = [
  { id: 1, nome: 'Ficha Medição Aterramento' },
  { id: 2, nome: 'Ficha Equipamento' },
  { id: 3, nome: 'DP' },
];

// Opções fixas de motivo de pausa — substituem o campo livre de texto
const MOTIVOS_PAUSA = [
  'Almoço/Café',
  'Carregar caminhão',
  'Mudança de equipe',
  'Aguardando material',
];

// stage: idle → deslocando → deslocamento_fim → atividade → concluido → deslocamento_volta → deslocamento_volta_fim → encerrado
export default function TrajetoScreen({ route, navigation }) {
  const { logout, user } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar, setObra: setSidebarObra } = useSidebar();
  const obra = route?.params?.obra ?? {};
  const [projeto, setProjeto] = useState(route?.params?.projeto ?? null);
  const [projetoAnnotations, setProjetoAnnotations] = useState(null);
  const [showPdfViewer, setShowPdfViewer] = useState(false);

  // Expõe obra ao sidebar para exibição em "Dados da Obra"
  useEffect(() => { setSidebarObra(obra); return () => setSidebarObra(null); }, []);

  // ── ESTADO DO FLUXO ──────────────────────────────────────────────────────
  const [stage, setStage]                       = useState('idle'); // etapa atual
  const [inicioDeslocamento, setInicioDeslocamento] = useState(null); // Date
  const [fimDeslocamento, setFimDeslocamento]   = useState(null);    // Date
  const [inicioAtividade, setInicioAtividade]         = useState(null); // Date
  const [inicioDeslocamentoVolta, setInicioDeslocamentoVolta] = useState(null); // Date
  const [fimDeslocamentoVolta, setFimDeslocamentoVolta]       = useState(null); // Date
  const [elapsed, setElapsed]                   = useState(0); // segundos decorridos na fase ativa
  // Timestamp absoluto (ms) do início da fase — permite recalcular o timer após fechar o app
  const [phaseStartedAt, setPhaseStartedAt]     = useState(null);
  const [sessionLoaded, setSessionLoaded]       = useState(false); // impede salvar antes de restaurar
  const [checklistsFeitos, setChecklistsFeitos] = useState({}); // { [id]: boolean }
  const [checklistsNA, setChecklistsNA] = useState({}); // { [id]: boolean } — marcados como N/A
  const [modalChecklistAberto, setModalChecklistAberto] = useState(null); // 1 | 2 | 3 | null
  const [dadosFichas, setDadosFichas] = useState({ 1: null, 2: null, 3: null }); // dados de cada ficha
  const [alteracaoExecucao, setAlteracaoExecucao] = useState(''); // 'Sim' | 'Não' | ''
  const [observacoesGerais, setObservacoesGerais] = useState('');

  // Pontos de trabalho lidos da coluna BC do Excel, ex: "2,5,8"
  const [pontosExecucao, setPontosExecucao] = useState(() => {
    const raw = obra?.['Ponto de Trabalho'] ?? '';
    return raw
      ? String(raw).split(',').map(p => ({ ponto: p.trim(), executado: '', restricao: '', responsabilidade: '', observacao: '' }))
      : [];
  });
  const [restricaoPickerIdx, setRestricaoPickerIdx] = useState(null); // índice do ponto com picker aberto
  const [fotos, setFotos]                       = useState([null, null, null]); // URIs do AS BUILD

  const AS_BUILD_LABELS = [
    { label: 'Visão geral da obra', obrigatoria: true },
    { label: 'Visão com equipamentos instalados', obrigatoria: true },
    { label: 'Foto adicional', obrigatoria: false },
  ];
  const [showPausaModal, setShowPausaModal]     = useState(false); // exibe modal de motivo
  const [motivoPausa, setMotivoPausa]           = useState(''); // motivo selecionado no modal
  const [pausaAtual, setPausaAtual]             = useState(null); // pausa em andamento: { inicio, motivo }
  const [pausas, setPausas]                     = useState([]);   // histórico de pausas concluídas
  const [eventosLocalizacao, setEventosLocalizacao] = useState([]); // log de eventos com GPS
  const timerRef = useRef(null); // referência do setInterval do timer

  // ── TIMER ── recalcula elapsed a partir do timestamp absoluto a cada segundo
  useEffect(() => {
    const active = stage === 'deslocando' || stage === 'atividade' || stage === 'deslocamento_volta';
    if (active && phaseStartedAt) {
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - phaseStartedAt) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [stage, phaseStartedAt]);

  // ── RESTAURAR SESSÃO ── ao montar, tenta retomar de onde parou (strings ISO → Date)
  useEffect(() => {
    loadTrajetoSession().then(s => {
      if (s && s.stage && s.stage !== 'encerrado') {
        setStage(s.stage);
        setPhaseStartedAt(s.phaseStartedAt ?? null);
        setInicioDeslocamento(s.inicioDeslocamento ? new Date(s.inicioDeslocamento) : null);
        setFimDeslocamento(s.fimDeslocamento ? new Date(s.fimDeslocamento) : null);
        setInicioAtividade(s.inicioAtividade ? new Date(s.inicioAtividade) : null);
        setInicioDeslocamentoVolta(s.inicioDeslocamentoVolta ? new Date(s.inicioDeslocamentoVolta) : null);
        setFimDeslocamentoVolta(s.fimDeslocamentoVolta ? new Date(s.fimDeslocamentoVolta) : null);
        setChecklistsFeitos(s.checklistsFeitos ?? {});
        setChecklistsNA(s.checklistsNA ?? {});
        setDadosFichas(s.dadosFichas ?? { 1: null, 2: null, 3: null });
        setAlteracaoExecucao(s.alteracaoExecucao ?? '');
        setObservacoesGerais(s.observacoesGerais ?? '');
        if (s.pontosExecucao) setPontosExecucao(s.pontosExecucao.map(p => ({
          restricao: '', responsabilidade: '', observacao: '', ...p,
        })));
        setFotos(s.fotos ?? [null, null, null]);
        setPausaAtual(s.pausaAtual ? { ...s.pausaAtual, inicio: new Date(s.pausaAtual.inicio) } : null);
        setPausas(s.pausas ? s.pausas.map(p => ({ ...p, inicio: new Date(p.inicio), fim: new Date(p.fim) })) : []);
        setEventosLocalizacao(s.eventosLocalizacao ? s.eventosLocalizacao.map(e => ({ ...e, horario: new Date(e.horario) })) : []);
        // Set elapsed immediately so timer shows correct value before first interval tick
        const activeStages = ['deslocando', 'atividade', 'deslocamento_volta'];
        if (s.phaseStartedAt && activeStages.includes(s.stage)) {
          setElapsed(Math.floor((Date.now() - s.phaseStartedAt) / 1000));
        }
      }
      setSessionLoaded(true);
    });
  }, []);

  // ── PERSISTIR SESSÃO ── salva estado sempre que algo muda; limpa ao encerrar
  useEffect(() => {
    if (!sessionLoaded) return;
    if (stage === 'encerrado') {
      clearTrajetoSession();
      return;
    }
    saveTrajetoSession({
      stage,
      phaseStartedAt,
      obra: obra,
      inicioDeslocamento: inicioDeslocamento?.toISOString() ?? null,
      fimDeslocamento: fimDeslocamento?.toISOString() ?? null,
      inicioAtividade: inicioAtividade?.toISOString() ?? null,
      inicioDeslocamentoVolta: inicioDeslocamentoVolta?.toISOString() ?? null,
      fimDeslocamentoVolta: fimDeslocamentoVolta?.toISOString() ?? null,
      checklistsFeitos,
      checklistsNA,
      dadosFichas,
      alteracaoExecucao,
      observacoesGerais,
      pontosExecucao,
      fotos,
      pausaAtual: pausaAtual ? { ...pausaAtual, inicio: pausaAtual.inicio.toISOString() } : null,
      pausas: pausas.map(p => ({ ...p, inicio: p.inicio.toISOString(), fim: p.fim.toISOString() })),
      eventosLocalizacao: eventosLocalizacao.map(e => ({ ...e, horario: e.horario.toISOString() })),
    });
  }, [sessionLoaded, stage, phaseStartedAt, inicioDeslocamento, fimDeslocamento, inicioAtividade,
      inicioDeslocamentoVolta, fimDeslocamentoVolta, checklistsFeitos, checklistsNA, dadosFichas,
      alteracaoExecucao, observacoesGerais, pontosExecucao, fotos, pausaAtual, pausas, eventosLocalizacao]);

  // Registra evento com coordenadas GPS; fallback sem localização se GPS falhar
  async function registrarEvento(nome) {
    const horario = new Date();
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setEventosLocalizacao(prev => [...prev, {
        evento: nome,
        horario,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      }]);
    } catch {
      setEventosLocalizacao(prev => [...prev, { evento: nome, horario, latitude: null, longitude: null }]);
    }
  }

  // Converte segundos em HH:MM:SS para exibir no timer
  function formatTime(s) {
    const h = String(Math.floor(s / 3600)).padStart(2, '0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
    const sec = String(s % 60).padStart(2, '0');
    return `${h}:${m}:${sec}`;
  }

  // Encerra pausa ativa (se houver), registra evento GPS e inicia timer de deslocamento
  async function iniciarDeslocamento() {
    if (pausaAtual) {
      setPausas(prev => [...prev, { ...pausaAtual, fim: new Date() }]);
      setPausaAtual(null);
    }
    await registrarEvento('Início Deslocamento');
    const now = Date.now();
    setInicioDeslocamento(new Date(now));
    setPhaseStartedAt(now);
    setElapsed(0);
    setStage('deslocando');
  }

  // Registra chegada na obra e avança para etapa de atividade
  async function finalizarDeslocamento() {
    await registrarEvento('Chegada na Obra');
    setFimDeslocamento(new Date());
    setStage('deslocamento_fim');
  }

  // Encerra pausa ativa (se houver), registra evento e inicia timer de atividade
  async function iniciarAtividade() {
    if (pausaAtual) {
      setPausas(prev => [...prev, { ...pausaAtual, fim: new Date() }]);
      setPausaAtual(null);
    }
    await registrarEvento('Início Atividade');
    const now = Date.now();
    setInicioAtividade(new Date(now));
    setPhaseStartedAt(now);
    setElapsed(0);
    setStage('atividade');
  }

  function marcarChecklist(id) {
    setChecklistsFeitos(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function abrirProjeto() {
    if (!projeto) return;
    setShowPdfViewer(true);
  }

  async function substituirProjeto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProjeto(result.assets[0]);
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

  function removerFoto(index) {
    setFotos(prev => prev.map((f, i) => i === index ? null : f));
  }

  const todosChecklistsFeitos = CHECKLISTS.every(c => checklistsFeitos[c.id] || checklistsNA[c.id]);
  // Exige as 2 fotos obrigatórias (visão geral + equipamentos instalados)
  const todasFotos = fotos[0] !== null && fotos[1] !== null;
  const podeFinalizarAtividade = todosChecklistsFeitos && todasFotos;

  async function finalizarAtividade() {
    await registrarEvento('Finalizar Atividade');
    clearInterval(timerRef.current);
    setStage('concluido');
  }

  async function iniciarDeslocamentoVolta() {
    await registrarEvento('Início Deslocamento de Volta');
    const now = Date.now();
    setInicioDeslocamentoVolta(new Date(now));
    setPhaseStartedAt(now);
    setElapsed(0);
    setStage('deslocamento_volta');
  }

  async function finalizarDeslocamentoVolta() {
    await registrarEvento('Retorno à Base');
    setFimDeslocamentoVolta(new Date());
    setStage('deslocamento_volta_fim');
  }

  // Registra evento final e gera relatório Excel
  async function encerrarDia() {
    await registrarEvento('Encerrar Dia');
    clearInterval(timerRef.current);
    await gerarRelatorio();
  }

  // Monta workbook Excel com todos os dados do trajeto e compartilha/baixa o arquivo
  // No web: baixa o PDF e o Excel separadamente; no nativo: usa Sharing API
  async function gerarRelatorio() {
    try {
      const hoje = new Date();
      const dataStr = hoje.toLocaleDateString('pt-BR');

      const reportData = {
        user,
        obra,
        inicioDeslocamento: inicioDeslocamento?.toISOString() ?? null,
        fimDeslocamento: fimDeslocamento?.toISOString() ?? null,
        inicioAtividade: inicioAtividade?.toISOString() ?? null,
        inicioDeslocamentoVolta: inicioDeslocamentoVolta?.toISOString() ?? null,
        fimDeslocamentoVolta: fimDeslocamentoVolta?.toISOString() ?? null,
        pausas: pausas.map(p => ({ ...p, inicio: p.inicio.toISOString(), fim: p.fim.toISOString() })),
        eventosLocalizacao: eventosLocalizacao.map(e => ({ ...e, horario: e.horario.toISOString() })),
        checklistsFeitos,
        dadosFichas,
        alteracaoExecucao,
        observacoesGerais,
        pontosExecucao,
      };

      await saveReport(reportData);

      const wb = buildWorkbook(reportData);
      const sigla = user?.sigla ?? 'SIgo';
      const nomeArquivo = `Relatorio_${sigla}_${dataStr.replace(/\//g, '-')}.xlsx`;

      if (Platform.OS === 'web') {
        if (projeto?.uri) {
          const a = document.createElement('a');
          a.href = projeto.uri;
          a.download = projeto.name ?? 'projeto.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        }
        XLSX.writeFile(wb, nomeArquivo);
      } else {
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const path = FileSystem.documentDirectory + nomeArquivo;
        await FileSystem.writeAsStringAsync(path, base64, {
          encoding: FileSystem.EncodingType.Base64,
        });
        if (projeto?.uri) {
          await Sharing.shareAsync(projeto.uri, { dialogTitle: 'Compartilhar PDF do Projeto' });
        }
        await Sharing.shareAsync(path, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Compartilhar Relatório',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
      await clearTrajetoSession();
      navigation.reset({ index: 0, routes: [{ name: 'Formulario' }] });
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível gerar o relatório.');
    }
  }

  const stageInfo = STAGE_INFO[stage] ?? { label: 'Trajeto', step: 1 };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>←</Text>
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>{stageInfo.label.toUpperCase()}</Text>
          {(obra['OVNOTA'] ?? obra.numero) ? (
            <Text style={styles.headerSubtitle}>{(obra['OVNOTA'] ?? obra.numero).toString()}</Text>
          ) : null}
          <View style={styles.stepDots}>
            {[1, 2, 3].map(n => (
              <View key={n} style={[styles.stepDot, stageInfo.step >= n && styles.stepDotAtivo]} />
            ))}
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
          <TouchableOpacity onPress={openSidebar} style={styles.menuBtn}>
            <Text style={styles.logoutText}>☰</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
            <Text style={styles.logoutText}>Sair</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Barra de atalhos para testes */}
      <View style={styles.devBar}>
        <TouchableOpacity
          style={styles.devBtn}
          onPress={() => {
            const feitos = {};
            CHECKLISTS.forEach(c => { feitos[c.id] = true; });
            setChecklistsFeitos(feitos);
            setFotos(['https://picsum.photos/200', 'https://picsum.photos/201', 'https://picsum.photos/202']);
          }}
        >
          <Text style={styles.devBtnText}>⚡ Preencher tudo</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]} keyboardShouldPersistTaps="handled">

        {/* ── ETAPA 1: DESLOCAMENTO ── */}
        <StepCard
          numero="1"
          titulo="Deslocamento"
          ativa={stage === 'idle' || stage === 'deslocando' || stage === 'deslocamento_fim'}
          concluida={stage === 'deslocamento_fim' || stage === 'atividade' || stage === 'concluido'}
        >
          {stage === 'idle' && (
            <>
              <View style={styles.atividadeRow}>
                <TouchableOpacity
                  style={[styles.btnPausa, pausaAtual && styles.btnPausaAtiva]}
                  onPress={() => { setMotivoPausa(''); setShowPausaModal(true); }}
                  activeOpacity={0.85}
                  disabled={!!pausaAtual}
                >
                  <Text style={styles.btnText}>{pausaAtual ? '⏸' : 'Pausa'}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.btnGreen, { flex: 1 }]} onPress={iniciarDeslocamento} activeOpacity={0.85}>
                  <Text style={styles.btnText}>Iniciar Deslocamento</Text>
                </TouchableOpacity>
              </View>
              {pausaAtual && (
                <View style={styles.pausaAtivaBox}>
                  <Text style={styles.pausaAtivaLabel}>Em pausa desde {pausaAtual.inicio.toLocaleTimeString('pt-BR')}</Text>
                  <Text style={styles.pausaAtivaMotivo}>"{pausaAtual.motivo}"</Text>
                </View>
              )}
            </>
          )}

          {stage === 'deslocando' && (
            <>
              <Text style={[styles.timer, { color: colors.timer }]}>{formatTime(elapsed)}</Text>
              <Text style={[styles.timerLabel, { color: colors.timerLabel }]}>em deslocamento</Text>
              <TouchableOpacity style={styles.btnRed} onPress={finalizarDeslocamento} activeOpacity={0.85}>
                <Text style={styles.btnText}>Finalizar Deslocamento</Text>
              </TouchableOpacity>
            </>
          )}

          {fimDeslocamento && (
            <View style={styles.resumoRow}>
              <Text style={[styles.resumoLabel, { color: colors.resumeLabel }]}>Início</Text>
              <Text style={[styles.resumoValor, { color: colors.resumeValue }]}>{inicioDeslocamento?.toLocaleTimeString('pt-BR')}</Text>
              <Text style={[styles.resumoSep, { color: colors.textSub }]}>→</Text>
              <Text style={[styles.resumoLabel, { color: colors.resumeLabel }]}>Fim</Text>
              <Text style={[styles.resumoValor, { color: colors.resumeValue }]}>{fimDeslocamento?.toLocaleTimeString('pt-BR')}</Text>
            </View>
          )}
          {pausas.map((p, i) => {
            const duracaoSeg = Math.round((p.fim - p.inicio) / 1000);
            return (
              <View key={i} style={styles.pausaRegistro}>
                <View style={styles.pausaRegistroHeader}>
                  <Text style={styles.pausaRegistroBadge}>⏸ Pausa</Text>
                  <Text style={styles.pausaRegistroDuracao}>{formatTime(duracaoSeg)}</Text>
                </View>
                <Text style={styles.pausaRegistroTempos}>
                  {p.inicio.toLocaleTimeString('pt-BR')} → {p.fim.toLocaleTimeString('pt-BR')}
                </Text>
                <Text style={styles.pausaRegistroMotivo}>"{p.motivo}"</Text>
              </View>
            );
          })}
        </StepCard>

        {/* ── ETAPA 2: ATIVIDADE ── */}
        {['deslocamento_fim','atividade','concluido','deslocamento_volta','deslocamento_volta_fim','encerrado'].includes(stage) && (
          <StepCard
            numero="2"
            titulo="Atividade"
            ativa={stage === 'deslocamento_fim' || stage === 'atividade'}
            concluida={['concluido','deslocamento_volta','deslocamento_volta_fim','encerrado'].includes(stage)}
          >
            {stage === 'deslocamento_fim' && (
              <>
                <View style={styles.atividadeRow}>
                  <TouchableOpacity
                    style={[styles.btnPausa, pausaAtual && styles.btnPausaAtiva]}
                    onPress={() => { setMotivoPausa(''); setShowPausaModal(true); }}
                    activeOpacity={0.85}
                    disabled={!!pausaAtual}
                  >
                    <Text style={styles.btnText}>{pausaAtual ? '⏸' : 'Pausa'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.btnGreen, { flex: 1 }]} onPress={iniciarAtividade} activeOpacity={0.85}>
                    <Text style={styles.btnText}>Iniciar Atividade</Text>
                  </TouchableOpacity>
                </View>
                {pausaAtual && (
                  <View style={styles.pausaAtivaBox}>
                    <Text style={styles.pausaAtivaLabel}>Em pausa desde {pausaAtual.inicio.toLocaleTimeString('pt-BR')}</Text>
                    <Text style={styles.pausaAtivaMotivo}>"{pausaAtual.motivo}"</Text>
                  </View>
                )}
              </>
            )}

            {stage !== 'deslocamento_fim' && (
              <>
                {/* Timer da atividade */}
                {stage === 'atividade' && (
                  <>
                    <Text style={[styles.timer, { color: colors.timer }]}>{formatTime(elapsed)}</Text>
                    <Text style={[styles.timerLabel, { color: colors.timerLabel }]}>em atividade</Text>
                  </>
                )}

                {stage !== 'atividade' && inicioAtividade && (
                  <View style={styles.resumoRow}>
                    <Text style={[styles.resumoLabel, { color: colors.resumeLabel }]}>Início</Text>
                    <Text style={[styles.resumoValor, { color: colors.resumeValue }]}>{inicioAtividade?.toLocaleTimeString('pt-BR')}</Text>
                  </View>
                )}

                {/* Execução (checklists) */}
                <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>Execução</Text>

                {/* Pontos de Trabalho */}
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
                            <Text style={[styles.pontoCellPonto, { flex: 1, color: colors.text }]}>{item.ponto}</Text>
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
                                      if (stage !== 'atividade') return;
                                      setPontosExecucao(prev => prev.map((p, i) =>
                                        i === idx ? { ...p, executado: op, restricao: op === 'Sim' ? '' : p.restricao, responsabilidade: op === 'Sim' ? '' : p.responsabilidade, observacao: op === 'Sim' ? '' : p.observacao } : p
                                      ));
                                    }}
                                    disabled={stage !== 'atividade'}
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
                              {/* Responsabilidade Execução */}
                              <Text style={[styles.pontoExpandidoLabel, { color: colors.fieldLabel ?? '#6B7280' }]}>Responsabilidade Execução</Text>
                              <View style={styles.pontoOpcoes}>
                                {['EDP', 'Parceira', 'Terceiro'].map(op => (
                                  <TouchableOpacity
                                    key={op}
                                    style={[styles.pontoOpBtn, item.responsabilidade === op && styles.pontoOpBtnAtivo]}
                                    onPress={() => {
                                      if (stage !== 'atividade') return;
                                      setPontosExecucao(prev => prev.map((p, i) => i === idx ? { ...p, responsabilidade: op } : p));
                                    }}
                                    disabled={stage !== 'atividade'}
                                  >
                                    <Text style={[styles.pontoOpBtnText, item.responsabilidade === op && styles.pontoOpBtnTextAtivo]}>{op}</Text>
                                  </TouchableOpacity>
                                ))}
                              </View>

                              {/* Restrição de Execução */}
                              <Text style={[styles.pontoExpandidoLabel, { color: colors.fieldLabel ?? '#6B7280', marginTop: 8 }]}>Restrição de Execução</Text>
                              <TouchableOpacity
                                style={[styles.pontoPickerBtn, { borderColor: !item.restricao ? '#EF4444' : colors.border, backgroundColor: colors.card }]}
                                onPress={() => stage === 'atividade' && setRestricaoPickerIdx(idx)}
                              >
                                <Text style={[styles.pontoPickerBtnText, { color: item.restricao ? colors.text : '#EF4444' }]} numberOfLines={1}>
                                  {item.restricao || 'Selecionar (obrigatório)'}
                                </Text>
                                <Text style={{ color: colors.textMuted, fontSize: 12 }}>▼</Text>
                              </TouchableOpacity>

                              {/* Observação da Execução */}
                              <Text style={[styles.pontoExpandidoLabel, { color: colors.fieldLabel ?? '#6B7280', marginTop: 8 }]}>Observação da Execução</Text>
                              <TextInput
                                style={[styles.pontoJustInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.inputText }]}
                                value={item.observacao}
                                onChangeText={v => {
                                  if (stage !== 'atividade') return;
                                  setPontosExecucao(prev => prev.map((p, i) => i === idx ? { ...p, observacao: v } : p));
                                }}
                                placeholder="Observação..."
                                placeholderTextColor={colors.textMuted}
                                multiline
                                textAlignVertical="top"
                                editable={stage === 'atividade'}
                              />
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                )}

                {/* Checklists */}
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
                        onPress={() => { if (stage === 'atividade' && !na) setModalChecklistAberto(c.id); }}
                        activeOpacity={0.7}
                        disabled={stage !== 'atividade' || na}
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
                          onPress={() => stage === 'atividade' && setChecklistsNA(prev => ({ ...prev, [c.id]: false }))}
                        >
                          <Text style={styles.naBtnText}>N/A</Text>
                          <Text style={[styles.naBtnText, { fontSize: 12 }]}>✕</Text>
                        </TouchableOpacity>
                      )}
                      {!feito && !na && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <TouchableOpacity
                            onPress={() => { if (stage === 'atividade') setModalChecklistAberto(c.id); }}
                            disabled={stage !== 'atividade'}
                          >
                            <Text style={[styles.abrirText, { color: colors.linkText }]}>Abrir →</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.naBtn}
                            onPress={() => {
                              if (stage !== 'atividade') return;
                              setChecklistsNA(prev => ({ ...prev, [c.id]: true }));
                            }}
                            disabled={stage !== 'atividade'}
                          >
                            <Text style={styles.naBtnText}>N/A</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* Alterações e observações */}
                <Text style={[styles.sectionTitle, { color: colors.sectionTitle }]}>AS BUILD</Text>
                <Text style={[styles.execPergunta, { color: colors.text }]}>Houveram alterações na execução conforme era o projeto?</Text>
                <View style={styles.execToggleRow}>
                  {['Sim', 'Não'].map(op => (
                    <TouchableOpacity
                      key={op}
                      style={styles.execCheckOpcao}
                      onPress={() => stage === 'atividade' && setAlteracaoExecucao(op)}
                    >
                      <View style={[styles.execCheckBox, !(alteracaoExecucao === op) && { backgroundColor: colors.inputBg, borderColor: colors.border }, alteracaoExecucao === op && styles.execCheckBoxAtivo]}>
                        {alteracaoExecucao === op && <Text style={styles.execCheckMark}>✓</Text>}
                      </View>
                      <Text style={[styles.execCheckLabel, { color: colors.text }]}>{op}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
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
                  editable={stage === 'atividade'}
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
                        stage === 'atividade' && (
                          <TouchableOpacity style={styles.asBuildRemove} onPress={() => removerFoto(i)}>
                            <Text style={styles.asBuildRemoveText}>✕</Text>
                          </TouchableOpacity>
                        )
                      ) : (
                        <View style={styles.asBuildBtns}>
                          <TouchableOpacity
                            style={[styles.asBuildBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                            onPress={() => tirarFoto(i)}
                            disabled={stage !== 'atividade'}
                          >
                            <Text style={[styles.asBuildBtnText, { color: colors.textSub }]}>Câmera</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.asBuildBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                            onPress={() => anexarFoto(i)}
                            disabled={stage !== 'atividade'}
                          >
                            <Text style={[styles.asBuildBtnText, { color: colors.textSub }]}>Galeria</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  );
                })}

                {/* PDF Projeto */}
                <View style={[styles.projetoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.projetoInfo}>
                    <Text style={[styles.projetoIcon, { color: colors.textMuted }]}>PDF</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.projetoTitulo, { color: colors.heading }]}>Projeto (PDF)</Text>
                      <Text style={[styles.projetoNome, { color: colors.textSub }]} numberOfLines={1}>
                        {projeto ? projeto.name : 'Nenhum arquivo importado'}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.projetoBtns}>
                    {projeto ? (
                      <>
                        <TouchableOpacity style={[styles.projetoBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={abrirProjeto}>
                          <Text style={[styles.projetoBtnText, { color: colors.heading }]}>Abrir</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.projetoBtn, { backgroundColor: colors.inputBg, borderColor: colors.border }]} onPress={substituirProjeto}>
                          <Text style={[styles.projetoBtnText, { color: colors.heading }]}>Substituir</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity style={[styles.projetoBtn, { backgroundColor: colors.inputBg, borderColor: colors.border, flex: 1 }]} onPress={substituirProjeto}>
                        <Text style={[styles.projetoBtnText, { color: colors.heading }]}>+ Importar PDF</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>

                {/* Finalizar */}
                {stage === 'atividade' && (
                  <>
                    <TouchableOpacity
                      style={[styles.btnRed, !podeFinalizarAtividade && styles.btnDisabled]}
                      onPress={finalizarAtividade}
                      disabled={!podeFinalizarAtividade}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.btnText}>Finalizar Atividade</Text>
                    </TouchableOpacity>
                    {!podeFinalizarAtividade && (
                      <Text style={styles.hint}>
                        Complete os checklists e as 2 fotos obrigatórias do AS BUILD para finalizar.
                      </Text>
                    )}
                  </>
                )}
              </>
            )}
          </StepCard>
        )}

        {/* ── OPÇÕES PÓS-ATIVIDADE ── */}
        {stage === 'concluido' && (
          <View style={[styles.opcoesCard, { backgroundColor: colors.opcoesCard }]}>
            <Text style={[styles.opcoesTitle, { color: colors.text }]}>Atividade concluída! O que deseja fazer?</Text>
            <TouchableOpacity style={styles.btnGreen} onPress={iniciarDeslocamentoVolta} activeOpacity={0.85}>
              <Text style={styles.btnText}>Iniciar Deslocamento de Volta</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnBlue} onPress={gerarRelatorio} activeOpacity={0.85}>
              <Text style={styles.btnText}>Finalizar Obra</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ETAPA 3: DESLOCAMENTO DE VOLTA ── */}
        {['deslocamento_volta','deslocamento_volta_fim','encerrado'].includes(stage) && (
          <StepCard
            numero="3"
            titulo="Deslocamento de Volta"
            ativa={stage === 'deslocamento_volta' || stage === 'deslocamento_volta_fim'}
            concluida={stage === 'encerrado'}
          >
            {stage === 'deslocamento_volta' && (
              <>
                <Text style={[styles.timer, { color: colors.timer }]}>{formatTime(elapsed)}</Text>
                <Text style={[styles.timerLabel, { color: colors.timerLabel }]}>em deslocamento de volta</Text>
                <TouchableOpacity style={styles.btnRed} onPress={finalizarDeslocamentoVolta} activeOpacity={0.85}>
                  <Text style={styles.btnText}>Finalizar Deslocamento de Volta</Text>
                </TouchableOpacity>
              </>
            )}
            {(stage === 'deslocamento_volta_fim' || stage === 'encerrado') && (
              <View style={styles.resumoRow}>
                <Text style={[styles.resumoLabel, { color: colors.resumeLabel }]}>Início</Text>
                <Text style={[styles.resumoValor, { color: colors.resumeValue }]}>{inicioDeslocamentoVolta?.toLocaleTimeString('pt-BR')}</Text>
                <Text style={[styles.resumoSep, { color: colors.textSub }]}>→</Text>
                <Text style={[styles.resumoLabel, { color: colors.resumeLabel }]}>Fim</Text>
                <Text style={[styles.resumoValor, { color: colors.resumeValue }]}>{fimDeslocamentoVolta?.toLocaleTimeString('pt-BR')}</Text>
              </View>
            )}
          </StepCard>
        )}

        {/* ── OPÇÕES PÓS-DESLOCAMENTO DE VOLTA ── */}
        {stage === 'deslocamento_volta_fim' && (
          <View style={[styles.opcoesCard, { backgroundColor: colors.opcoesCard }]}>
            <Text style={[styles.opcoesTitle, { color: colors.text }]}>Deslocamento de volta concluído! O que deseja fazer?</Text>
            <TouchableOpacity style={styles.btnBlue} onPress={gerarRelatorio} activeOpacity={0.85}>
              <Text style={styles.btnText}>Finalizar Obra</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnRed} onPress={encerrarDia} activeOpacity={0.85}>
              <Text style={styles.btnText}>Encerrar o Dia</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── DIA ENCERRADO ── */}
        {stage === 'encerrado' && (
          <View style={[styles.concluidoBox, { backgroundColor: colors.concluidoBox }]}>
            <Text style={styles.concluidoIcon}>🏁</Text>
            <Text style={[styles.concluidoTitulo, { color: colors.cardDoneLeft }]}>Dia Encerrado</Text>
            <Text style={[styles.concluidoSub, { color: colors.textSub }]}>Obrigado pelo trabalho de hoje!</Text>
            <TouchableOpacity style={styles.btnRelatorio} onPress={gerarRelatorio} activeOpacity={0.85}>
              <Text style={styles.btnText}>Gerar Relatório Excel</Text>
            </TouchableOpacity>
          </View>
        )}

      </ScrollView>

      {/* ── MODAIS DE CHECKLIST ── cada um coleta dados e marca o checklist como feito */}
      {/* Modal Ficha Medição Aterramento */}
      <FichaMedicaoAterramentoModal
        visible={modalChecklistAberto === 1}
        onClose={() => setModalChecklistAberto(null)}
        onConcluir={dados => {
          setDadosFichas(prev => ({ ...prev, 1: dados }));
          setChecklistsFeitos(prev => ({ ...prev, 1: true }));
        }}
        pontosProgramados={pontosExecucao.map(p => p.ponto)}
      />

      {/* Modal Ficha Equipamento */}
      <FichaEquipamentoModal
        visible={modalChecklistAberto === 2}
        onClose={() => setModalChecklistAberto(null)}
        onConcluir={dados => {
          setDadosFichas(prev => ({ ...prev, 2: dados }));
          setChecklistsFeitos(prev => ({ ...prev, 2: true }));
        }}
        obra={obra}
      />

      {/* Modal DP */}
      <DPModal
        visible={modalChecklistAberto === 3}
        onClose={() => setModalChecklistAberto(null)}
        onConcluir={dados => {
          setDadosFichas(prev => ({ ...prev, 3: dados }));
          setChecklistsFeitos(prev => ({ ...prev, 3: true }));
        }}
        obra={obra}
      />

      <PDFViewerModal
        visible={showPdfViewer}
        uri={projeto?.uri}
        nome={projeto?.name}
        annotations={projetoAnnotations}
        onClose={() => setShowPdfViewer(false)}
        onSaveAnnotations={data => setProjetoAnnotations(data)}
        onUpdate={novoPdf => setProjeto(novoPdf)}
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

      {/* ── MODAL DE PAUSA ── exibe chips de motivo; confirmar inicia pausa e registra evento GPS */}
      <Modal
        visible={showPausaModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPausaModal(false)}
      >
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
                      ativo && { backgroundColor: colors.cardDoneLeft, borderColor: colors.cardDoneLeft }]}
                    onPress={() => setMotivoPausa(motivo)}
                    activeOpacity={0.7}
                  >
                    <Text style={[styles.motivoChipText, { color: colors.text },
                      ativo && { color: '#0F1A0A', fontWeight: '800' }]}>
                      {motivo}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={styles.pausaActions}>
              <TouchableOpacity
                style={[styles.pausaCancelBtn, { borderColor: colors.border }]}
                onPress={() => setShowPausaModal(false)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pausaCancelText, { color: colors.textSub }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.pausaConfirmBtn, !motivoPausa.trim() && styles.btnDisabled]}
                onPress={async () => {
                  if (!motivoPausa.trim()) return;
                  await registrarEvento('Início Pausa');
                  setPausaAtual({ inicio: new Date(), motivo: motivoPausa.trim() });
                  setShowPausaModal(false);
                }}
                disabled={!motivoPausa.trim()}
                activeOpacity={0.8}
              >
                <Text style={styles.pausaConfirmText}>Confirmar Pausa</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// Wrapper visual de cada etapa: badge numerado, título e tag "Concluído" quando done=true
function StepCard({ numero, titulo, ativa, concluida, children }) {
  const { colors } = useTheme();
  return (
    <View style={[
      sc.card,
      { backgroundColor: colors.card },
      concluida && { borderLeftWidth: 4, borderLeftColor: colors.cardDoneLeft },
    ]}>
      <View style={sc.header}>
        <View style={[sc.badge, concluida && { backgroundColor: colors.cardDoneLeft }]}>
          <Text style={[sc.badgeText, concluida && { color: '#1A2636' }]}>{concluida ? '✓' : numero}</Text>
        </View>
        <Text style={[sc.titulo, { color: colors.timer }, concluida && { color: colors.cardDoneLeft }]}>{titulo}</Text>
        {concluida && (
          <Text style={[sc.tag, { backgroundColor: colors.tagDoneBg, color: colors.tagDoneText }]}>
            Concluído
          </Text>
        )}
      </View>
      <View style={sc.body}>{children}</View>
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardDone: { borderLeftWidth: 4, borderLeftColor: '#16A34A' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 10 },
  badge: {
    width: 28, height: 28, borderRadius: 14, backgroundColor: '#1E3A5F',
    justifyContent: 'center', alignItems: 'center',
  },
  badgeDone: { backgroundColor: '#16A34A' },
  badgeText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  titulo: { fontSize: 15, fontWeight: '700', color: '#1E3A5F', flex: 1 },
  tituloDone: { color: '#16A34A' },
  tag: {
    fontSize: 11, fontWeight: '700', color: '#16A34A',
    backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20,
  },
  body: { gap: 8 },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerCenter: {
    position: 'absolute', left: 0, right: 0, alignItems: 'center', gap: 6,
    pointerEvents: 'none',
  },
  headerTitle: { fontSize: 14, fontWeight: '800', color: '#FFF', letterSpacing: 1.2 },
  headerSubtitle: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.65)', letterSpacing: 0.5, marginTop: -2, textAlign: 'center', alignSelf: 'center' },
  stepDots: { flexDirection: 'row', gap: 6 },
  stepDot: { width: 24, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  stepDotAtivo: { backgroundColor: '#FFF' },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 36, height: 36, borderRadius: 10,
    justifyContent: 'center', alignItems: 'center',
  },
  backText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  menuBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  logoutText: { color: '#FFF', fontSize: 13, fontWeight: '600' },
  devBar: {
    backgroundColor: '#1E3A5F', paddingVertical: 4, paddingHorizontal: 16,
    alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  devBtn: { paddingVertical: 2 },
  devBtnText: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  body: { flexGrow: 1, backgroundColor: '#F3F4F6', padding: 16, paddingBottom: 40 },

  timer: { fontSize: 40, fontWeight: '900', color: '#1E3A5F', textAlign: 'center' },
  timerLabel: { fontSize: 12, color: '#6B7280', textAlign: 'center', marginBottom: 8 },

  resumoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  resumoLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600' },
  resumoValor: { fontSize: 13, color: '#111827', fontWeight: '700' },
  resumoSep: { color: '#9CA3AF', fontWeight: '600' },

  sectionTitle: {
    fontSize: 12, fontWeight: '700', color: '#374151',
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 6,
  },

  checkRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12,
    paddingHorizontal: 12, borderRadius: 10, backgroundColor: '#F9FAFB',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  checkRowDone: { backgroundColor: '#F0FDF4', borderColor: '#86EFAC' },
  checkbox: {
    width: 28, height: 28, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
    backgroundColor: '#FFF',
  },
  checkboxDone: { backgroundColor: '#16A34A', borderColor: '#16A34A' },
  checkmark: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  checkIcon: { fontSize: 14 },
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

  asBuildItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderRadius: 10, padding: 10,
    marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB',
  },
  asBuildInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  asBuildThumb: { width: 48, height: 48, borderRadius: 8 },
  asBuildThumbVazio: {
    width: 48, height: 48, borderRadius: 8, backgroundColor: '#E5E7EB',
    justifyContent: 'center', alignItems: 'center',
  },
  asBuildThumbIcon: { fontSize: 20 },
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

  projetoCard: {
    borderWidth: 1, borderRadius: 10, padding: 10,
    marginBottom: 10, gap: 8,
  },
  projetoInfo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  projetoIcon: { fontSize: 24 },
  projetoTitulo: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  projetoNome: { fontSize: 12, marginTop: 1 },
  projetoBtns: { flexDirection: 'row', gap: 8 },
  projetoBtn: {
    flex: 1, borderWidth: 1, borderRadius: 8,
    paddingVertical: 7, alignItems: 'center',
  },
  projetoBtnText: { fontSize: 12, fontWeight: '700' },

  btnGreen: {
    backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', elevation: 3,
  },
  btnRed: {
    backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8, elevation: 3,
  },
  btnDisabled: { backgroundColor: '#D1D5DB', elevation: 0 },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },
  hint: { textAlign: 'center', color: '#9CA3AF', fontSize: 12, marginTop: 6 },

  opcoesCard: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 20, marginBottom: 12, gap: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  opcoesTitle: { fontSize: 14, fontWeight: '700', color: '#1E3A5F', marginBottom: 4 },
  btnBlue: {
    backgroundColor: '#1D4ED8', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', elevation: 3,
  },
  concluidoBox: {
    backgroundColor: '#FFF', borderRadius: 16, padding: 32,
    alignItems: 'center', gap: 8,
  },
  concluidoIcon: { fontSize: 48 },
  concluidoTitulo: { fontSize: 18, fontWeight: '800', color: '#16A34A' },
  concluidoSub: { fontSize: 13, color: '#6B7280' },
  btnRelatorio: {
    backgroundColor: '#1E3A5F', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', marginTop: 8, alignSelf: 'stretch',
  },

  atividadeRow: { flexDirection: 'row', gap: 10 },
  btnPausa: {
    backgroundColor: '#475569', borderRadius: 12, paddingVertical: 14,
    alignItems: 'center', elevation: 2, paddingHorizontal: 20,
  },
  btnPausaAtiva: { backgroundColor: '#334155', elevation: 0 },
  pausaAtivaBox: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#CBD5E1',
  },
  pausaAtivaLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
  pausaAtivaMotivo: { fontSize: 12, color: '#6B7280', marginTop: 2, fontStyle: 'italic' },

  pausaRegistro: {
    backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8,
  },
  pausaRegistroHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  pausaRegistroBadge: { fontSize: 12, fontWeight: '700', color: '#374151' },
  pausaRegistroDuracao: { fontSize: 12, fontWeight: '800', color: '#1E3A5F' },
  pausaRegistroTempos: { fontSize: 11, color: '#6B7280', marginTop: 3 },
  pausaRegistroMotivo: { fontSize: 11, color: '#9CA3AF', fontStyle: 'italic', marginTop: 2 },

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
  pausaSub: { fontSize: 13, color: '#6B7280', marginBottom: 16, lineHeight: 19 },
  motivosWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  motivoChip: {
    paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
  },
  motivoChipActive: { backgroundColor: '#D97706', borderColor: '#D97706' },
  motivoChipText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  motivoChipTextActive: { color: '#FFF' },
  pausaActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  pausaCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  pausaCancelText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  pausaConfirmBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    backgroundColor: '#D97706', alignItems: 'center',
  },
  pausaConfirmText: { fontSize: 14, fontWeight: '700', color: '#FFF' },
});
