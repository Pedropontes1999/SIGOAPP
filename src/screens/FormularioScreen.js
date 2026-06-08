import React, { useState, useMemo, useRef, useEffect } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
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
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { loadTrajetoSession, clearTrajetoSession, saveObrasList, loadObrasList, loadCompletedObras, clearCompletedObras } from '../storage/session';
import { excelDateToStr, excelTimeToStr } from '../utils/excelDate';
import { getPlaceholderMembers, getMembersByParceira } from '../data/mockMembers';

const COMPOSICAO_SIZE = { A3: 2, B1: 4, B2: 6, B3: 7, C1: 2, C2: 5, L3: 2 };


export default function FormularioScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors, isDark } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [detailsCollapsed, setDetailsCollapsed] = useState(false);

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

  // Seleção de arquivo Excel — Downloads + filtro por sigla
  const [showDownloads, setShowDownloads] = useState(false);
  const [downloadFiles, setDownloadFiles] = useState([]);
  const [parseLoading, setParseLoading] = useState(false);
  const [parseError, setParseError] = useState(null);
  const [parsedObras, setParsedObras] = useState([]);
  const [pendingAsset, setPendingAsset] = useState(null);
  const [showObraSelect, setShowObraSelect] = useState(false);
  const [selectedObra, setSelectedObra] = useState(null);

  // Lista de obras já carregadas de uma sessão anterior (não precisa re-enviar Excel)
  const [savedObrasList, setSavedObrasList] = useState([]);
  const [completedObras, setCompletedObras] = useState([]); // OVNOTAs já concluídos

  useEffect(() => {
    loadObrasList().then(list => setSavedObrasList(list ?? []));
    loadCompletedObras().then(list => setCompletedObras(list ?? []));
  }, []);

  const teamSize = user?.qtdColaboradores ?? COMPOSICAO_SIZE[user?.composicao] ?? 1;
  const [liderVisible, setLiderVisible] = useState(true);
  const [teamMembers, setTeamMembers] = useState(() =>
    getPlaceholderMembers(user).map(label => ({ label, visible: true }))
  );
  const [extras, setExtras] = useState([]);
  const parceiraMembros = useMemo(
    () => getMembersByParceira(user?.parceira ?? ''),
    [user?.parceira]
  );

  const visiblePreset = teamMembers.filter(m => m.visible);
  const totalVisible =
    (liderVisible ? 1 : 0) + visiblePreset.length + extras.length;
  const allComplete = extras.every(e => e.selected != null);

  function removeMember(index) {
    setTeamMembers(prev => prev.map((m, i) => i === index ? { ...m, visible: false } : m));
  }

  function addExtra() {
    setExtras(prev => [...prev, { id: Date.now(), query: '', selected: null, open: false }]);
  }

  function updateQuery(id, query) {
    setExtras(prev => prev.map(e =>
      e.id === id ? { ...e, query, selected: null, open: query.length > 0 } : e
    ));
  }

  function selectMember(id, member) {
    setExtras(prev => prev.map(e =>
      e.id === id ? { ...e, query: member, selected: member, open: false } : e
    ));
  }

  function removeExtra(id) {
    setExtras(prev => prev.filter(e => e.id !== id));
  }

  // Lê pasta Downloads do Android e retorna lista de xlsx ordenada por mais recente
  async function loadDownloadFiles() {
    try {
      const path = 'file:///storage/emulated/0/Download/';
      const names = await FileSystem.readDirectoryAsync(path);
      const xls = names.filter(n => /\.(xlsx|xls)$/i.test(n));
      const infos = await Promise.all(
        xls.map(async name => {
          const uri = path + encodeURIComponent(name);
          const info = await FileSystem.getInfoAsync(uri);
          return { name, uri, mtime: info.modificationTime ?? 0 };
        })
      );
      return infos.sort((a, b) => b.mtime - a.mtime).slice(0, 15);
    } catch {
      return [];
    }
  }

  // Abre picker: no Android tenta mostrar Downloads primeiro; iOS/web vai direto ao sistema
  async function openFilePicker() {
    if (Platform.OS === 'android') {
      const files = await loadDownloadFiles();
      if (files.length > 0) {
        setDownloadFiles(files);
        setShowDownloads(true);
        return;
      }
    }
    await pickFromSystem();
  }

  // Abre seletor de arquivo do sistema operacional
  async function pickFromSystem() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      // Passa o asset completo para que o web possa usar asset.file (FileReader)
      await processExcel(result.assets[0]);
    }
  }

  // Lê o Excel, filtra linhas pela sigla do usuário (coluna SiglaWPA) e gerencia seleção
  // asset: { uri, name, file? }  — file só existe no web (objeto File nativo)
  async function processExcel(asset) {
    const { uri, name, file } = asset ?? {};
    setParseLoading(true);
    setParseError(null);
    setShowDownloads(false);
    try {
      let rows;

      if (Platform.OS === 'web' && file) {
        // Web: usa FileReader para ler o objeto File nativo
        rows = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            try {
              const data = new Uint8Array(e.target.result);
              const wb = XLSX.read(data, { type: 'array' });
              const ws = wb.Sheets[wb.SheetNames[0]];
              resolve(XLSX.utils.sheet_to_json(ws, { defval: '' }));
            } catch (err) { reject(err); }
          };
          reader.onerror = reject;
          reader.readAsArrayBuffer(file);
        });
      } else {
        // Nativo: lê via FileSystem; copia para cache se vier de storage externo
        let readUri = uri;
        if (uri.startsWith('file:///storage/emulated/0/')) {
          const dest = FileSystem.cacheDirectory + name;
          await FileSystem.copyAsync({ from: uri, to: dest });
          readUri = dest;
        }
        const base64 = await FileSystem.readAsStringAsync(readUri, {
          encoding: FileSystem.EncodingType.Base64,
        });
        const wb = XLSX.read(base64, { type: 'base64' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      }

      const sigla = (user?.sigla ?? '').trim();
      const filtered = rows.filter(
        row => String(row['SiglaWPA'] ?? '').trim() === sigla
      );

      if (filtered.length === 0) {
        setParseError(`Nenhuma obra encontrada para a sigla "${sigla}" neste arquivo.`);
        setArquivoSelecionado(null);
        setSelectedObra(null);
        return;
      }

      // Persiste todas as obras da sigla; reseta concluídas pois é uma nova planilha
      await saveObrasList(filtered);
      await clearCompletedObras();
      setCompletedObras([]);
      setSavedObrasList(filtered);

      const fileAsset = { uri, name };

      if (filtered.length === 1) {
        setArquivoSelecionado(fileAsset);
        setSelectedObra(filtered[0]);
      } else {
        setPendingAsset(fileAsset);
        setParsedObras(filtered);
        setShowObraSelect(true);
      }
    } catch {
      setParseError('Não foi possível ler o arquivo. Verifique o formato.');
    } finally {
      setParseLoading(false);
    }
  }

  async function pickProjeto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProjetoSelecionado(result.assets[0]);
    }
  }

  function confirmarImportacao() {
    setShowImport(false);
    navigation.navigate('Obra', {
      arquivo: arquivoSelecionado,
      projeto: projetoSelecionado,
      obra: selectedObra,
    });
  }

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
                <View style={styles.half}><ReadOnlyField label="Sigla" value={user?.sigla} /></View>
                <View style={styles.half}><ReadOnlyField label="Parceira" value={user?.parceira} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}><ReadOnlyField label="Composição" value={user?.composicao} /></View>
                <View style={styles.half}><ReadOnlyField label="Tipo de Equipe" value={user?.tipoEquipe} /></View>
              </View>
              <View style={styles.row}>
                <View style={styles.half}><ReadOnlyField label="Placa do Veículo" value={user?.placa} /></View>
                <View style={styles.half}><ReadOnlyField label="Tipo de Veículo" value={user?.tipoVeiculo} /></View>
              </View>
            </>
          )}

          {detailsCollapsed && (
            <Text style={[styles.collapsedSummary, { color: colors.textSub }]}>
              {user?.sigla} · {user?.parceira} · {user?.composicao} · {user?.placa}
            </Text>
          )}
        </View>

        <View style={[styles.card, { marginTop: 12, backgroundColor: colors.card }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Equipe ({totalVisible})</Text>

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

          {extras.map((extra, i) => {
            const pos = extraPositions[i];
            const suggestions = extra.selected
              ? []
              : parceiraMembros.filter(m =>
                  extra.query.trim().length > 0 &&
                  m.toLowerCase().includes(extra.query.toLowerCase())
                ).slice(0, 8);

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

        <TouchableOpacity
          style={[styles.iniciarBtn, !allComplete && styles.iniciarBtnDisabled]}
          disabled={!allComplete}
          onPress={() => {
            setArquivoSelecionado(null);
            setSelectedObra(null);
            setParseError(null);
            if (savedObrasList.length > 0) {
              // Recarrega concluídas fresquinho antes de abrir o modal
              loadCompletedObras().then(done => {
                setCompletedObras(done ?? []);
                setParsedObras(savedObrasList);
                setPendingAsset(null);
                setShowObraSelect(true);
              });
            } else {
              setShowImport(true);
            }
          }}
          activeOpacity={0.85}
        >
          <Text style={styles.iniciarBtnText}>Confirmar Equipe</Text>
        </TouchableOpacity>

        {!allComplete && (
          <Text style={styles.hint}>Selecione um membro da lista para continuar</Text>
        )}

        {allComplete && savedObrasList.length > 0 && (
          <Text style={styles.hint}>
            {savedObrasList.length} obra{savedObrasList.length > 1 ? 's' : ''} carregada{savedObrasList.length > 1 ? 's' : ''} do Excel anterior
          </Text>
        )}
      </ScrollView>

      {/* Modal principal de importação de arquivos */}
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
            <TouchableOpacity
              style={[styles.pickBtn, arquivoSelecionado && !parseError && styles.pickBtnDone]}
              onPress={openFilePicker}
              disabled={parseLoading}
              activeOpacity={0.8}
            >
              <Feather
                name="file-text"
                size={18}
                color={arquivoSelecionado && !parseError ? '#16A34A' : '#6B7280'}
              />
              <Text style={styles.pickBtnText} numberOfLines={1}>
                {parseLoading
                  ? 'Processando...'
                  : arquivoSelecionado
                  ? arquivoSelecionado.name
                  : 'Escolher arquivo'}
              </Text>
              {parseLoading && <ActivityIndicator size="small" color="#1E3A5F" />}
            </TouchableOpacity>

            {parseError ? (
              <Text style={styles.parseErrorText}>{parseError}</Text>
            ) : selectedObra ? (
              <View style={styles.obraSelectedBadge}>
                <Feather name="check-circle" size={13} color="#16A34A" />
                <Text style={styles.obraSelectedText}>
                  {'OV ' + (selectedObra['OVNOTA'] || '—')}
                  {selectedObra['MUNICIPIO'] ? ' · ' + selectedObra['MUNICIPIO'] : ''}
                  {'\n'}
                  {excelDateToStr(selectedObra['DATAPROG'])}
                  {'  '}
                  {excelTimeToStr(selectedObra['HORAINI'])}
                  {' – '}
                  {excelTimeToStr(selectedObra['HORATER'])}
                </Text>
              </View>
            ) : null}

            <Text style={[styles.modalSectionLabel, { marginTop: 14 }]}>Projeto (PDF)</Text>
            <Text style={styles.modalSub}>PDF do projeto da obra</Text>
            <TouchableOpacity
              style={[styles.pickBtn, projetoSelecionado && styles.pickBtnDone]}
              onPress={pickProjeto}
              activeOpacity={0.8}
            >
              <Feather name="file" size={18} color={projetoSelecionado ? '#16A34A' : '#6B7280'} />
              <Text style={styles.pickBtnText} numberOfLines={1}>
                {projetoSelecionado ? projetoSelecionado.name : 'Escolher PDF'}
              </Text>
            </TouchableOpacity>

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowImport(false)} activeOpacity={0.8}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.continueBtn, (!arquivoSelecionado || !selectedObra || parseLoading) && styles.continueBtnDisabled]}
                onPress={confirmarImportacao}
                disabled={!arquivoSelecionado || !selectedObra || parseLoading}
                activeOpacity={0.8}
              >
                <Text style={styles.continueBtnText}>Continuar</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de arquivos recentes do Downloads (Android) */}
      <Modal
        visible={showDownloads}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDownloads(false)}
      >
        <Pressable style={styles.downloadsOverlay} onPress={() => setShowDownloads(false)}>
          <Pressable style={styles.downloadsCard} onPress={() => {}}>
            <View style={styles.downloadsHandle} />
            <Text style={styles.downloadsTitle}>Selecionar Planilha</Text>
            <Text style={styles.downloadsSub}>Arquivos Excel encontrados em Downloads</Text>

            <FlatList
              data={downloadFiles}
              keyExtractor={item => item.uri}
              style={styles.dlList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.dlItem}
                  onPress={() => processExcel({ uri: item.uri, name: item.name })}
                  activeOpacity={0.7}
                >
                  <View style={styles.dlIconBox}>
                    <Feather name="file-text" size={20} color="#16A34A" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dlName} numberOfLines={1}>{item.name}</Text>
                    {item.mtime > 0 && (
                      <Text style={styles.dlDate}>
                        {new Date(item.mtime * 1000).toLocaleDateString('pt-BR')}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color="#9CA3AF" />
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.dlSep} />}
            />

            {parseLoading && (
              <View style={styles.dlLoadingRow}>
                <ActivityIndicator size="small" color="#1E3A5F" />
                <Text style={styles.dlLoadingText}>Lendo arquivo...</Text>
              </View>
            )}

            <TouchableOpacity
              style={styles.dlBrowseBtn}
              onPress={async () => {
                setShowDownloads(false);
                await pickFromSystem();
              }}
              activeOpacity={0.8}
            >
              <Feather name="folder" size={16} color="#1E3A5F" />
              <Text style={styles.dlBrowseBtnText}>Procurar outros arquivos</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.dlCancelBtn}
              onPress={() => setShowDownloads(false)}
              activeOpacity={0.8}
            >
              <Text style={styles.dlCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Modal de seleção de obra quando há múltiplas para a sigla do usuário */}
      <Modal
        visible={showObraSelect}
        transparent
        animationType="fade"
        onRequestClose={() => setShowObraSelect(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowObraSelect(false)}>
          <Pressable style={[styles.modalCard, { maxHeight: '80%' }]} onPress={() => {}}>
            <Text style={styles.modalTitle}>Selecionar Obra</Text>
            <Text style={[styles.modalSub, { textAlign: 'center', marginBottom: 14 }]}>
              {parsedObras.length} obras encontradas para {user?.sigla}
            </Text>

            <FlatList
              data={parsedObras}
              keyExtractor={(item, i) => String(item['OVNOTA'] ?? i)}
              renderItem={({ item }) => {
                const isDone = completedObras.includes(String(item['OVNOTA'] ?? ''));
                return (
                  <TouchableOpacity
                    style={[styles.obraItem, isDone && styles.obraItemDone]}
                    onPress={() => {
                      if (pendingAsset) {
                        setSelectedObra(item);
                        setArquivoSelecionado(pendingAsset);
                        setPendingAsset(null);
                        setShowObraSelect(false);
                      } else {
                        setShowObraSelect(false);
                        navigation.navigate('Obra', { obra: item, projeto: null });
                      }
                    }}
                    activeOpacity={0.7}
                  >
                    <View style={styles.obraItemHeader}>
                      <Text style={[styles.obraOV, isDone && styles.obraOVDone]}>
                        OV {item['OVNOTA'] || '—'}
                      </Text>
                      {isDone && (
                        <View style={styles.obraDoneBadge}>
                          <Feather name="check" size={11} color="#FFF" />
                          <Text style={styles.obraDoneBadgeText}>Concluída</Text>
                        </View>
                      )}
                    </View>
                    {!!item['MUNICIPIO'] && (
                      <Text style={[styles.obraMunicipio, isDone && { color: '#9CA3AF' }]}>
                        {item['MUNICIPIO']}
                      </Text>
                    )}
                    {!!item['REFERENCIA'] && (
                      <Text style={[styles.obraRef, isDone && { color: '#9CA3AF' }]} numberOfLines={1}>
                        {item['REFERENCIA']}
                      </Text>
                    )}
                    <View style={styles.obraDateRow}>
                      <Feather name="calendar" size={12} color={isDone ? '#9CA3AF' : '#6B7280'} />
                      <Text style={[styles.obraDateTime, isDone && { color: '#9CA3AF' }]}>
                        {excelDateToStr(item['DATAPROG'])}
                      </Text>
                      <Feather name="clock" size={12} color={isDone ? '#9CA3AF' : '#6B7280'} style={{ marginLeft: 8 }} />
                      <Text style={[styles.obraDateTime, isDone && { color: '#9CA3AF' }]}>
                        {excelTimeToStr(item['HORAINI'])} – {excelTimeToStr(item['HORATER'])}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              }}
              ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: '#F3F4F6' }} />}
            />

            {/* Quando vier da lista salva, oferece trocar o Excel */}
            {!pendingAsset && (
              <TouchableOpacity
                style={styles.trocarExcelBtn}
                onPress={() => {
                  setShowObraSelect(false);
                  setArquivoSelecionado(null);
                  setSelectedObra(null);
                  setParseError(null);
                  setShowImport(true);
                }}
                activeOpacity={0.8}
              >
                <Feather name="upload" size={13} color="#1E3A5F" />
                <Text style={styles.trocarExcelText}>Enviar outro Excel</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.cancelBtn, { marginTop: 8 }]}
              onPress={() => {
                setShowObraSelect(false);
                setPendingAsset(null);
                setArquivoSelecionado(null);
                setSelectedObra(null);
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelBtnText}>Cancelar</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

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
  box: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11 },
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
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: '700' },
  toggleText: { fontSize: 12, fontWeight: '600' },
  collapsedSummary: { fontSize: 12, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
  memberRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 8 },
  memberBadge: {
    width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  memberBadgeText: { color: '#FFF', fontSize: 12, fontWeight: '800' },
  memberBox: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  memberSelf: { fontSize: 14, fontWeight: '700' },
  memberLabel: { fontSize: 13, fontWeight: '500' },
  minusBtn: {
    width: 36, height: 36, borderRadius: 10, backgroundColor: '#6B7280',
    justifyContent: 'center', alignItems: 'center', flexShrink: 0,
  },
  subInput: { borderWidth: 1.5, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 13 },
  dropdown: {
    marginLeft: 34, marginRight: 44, marginTop: 2,
    borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1, shadowRadius: 8, elevation: 6, overflow: 'hidden',
  },
  dropdownItem: { paddingHorizontal: 14, paddingVertical: 11 },
  dropdownText: { fontSize: 13 },
  dropdownEmpty: { paddingHorizontal: 14, paddingVertical: 11, fontSize: 12, fontStyle: 'italic' },
  addExtraBtn: {
    marginTop: 14, borderWidth: 1.5, borderColor: '#16A34A', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 11, alignItems: 'center',
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

  // Modal overlay compartilhado
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
    fontSize: 16, fontWeight: '800', color: '#1E3A5F', textAlign: 'center', marginBottom: 8,
  },
  modalSectionLabel: { fontSize: 13, fontWeight: '700', color: '#1E3A5F', marginBottom: 2 },
  modalSub: { fontSize: 12, color: '#6B7280', marginBottom: 8 },
  pickBtn: {
    borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12,
    alignItems: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#F9FAFB',
  },
  pickBtnDone: { borderColor: '#16A34A', borderStyle: 'solid', backgroundColor: '#F0FDF4' },
  pickBtnText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  parseErrorText: { fontSize: 12, color: '#DC2626', marginTop: 6, marginLeft: 2 },
  obraSelectedBadge: {
    marginTop: 8, flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: '#F0FDF4', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#BBF7D0',
  },
  obraSelectedText: { fontSize: 12, color: '#15803D', flex: 1, lineHeight: 18 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 24 },
  cancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
  },
  cancelBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  continueBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, backgroundColor: '#1E3A5F', alignItems: 'center' },
  continueBtnDisabled: { backgroundColor: '#D1D5DB' },
  continueBtnText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },

  // Downloads modal (slide from bottom)
  downloadsOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  downloadsCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12, shadowRadius: 12, elevation: 16,
    maxHeight: '80%',
  },
  downloadsHandle: {
    width: 40, height: 4, backgroundColor: '#D1D5DB',
    borderRadius: 2, alignSelf: 'center', marginBottom: 14,
  },
  downloadsTitle: { fontSize: 16, fontWeight: '800', color: '#1E3A5F', marginBottom: 4 },
  downloadsSub: { fontSize: 12, color: '#6B7280', marginBottom: 12 },
  dlList: { maxHeight: 300 },
  dlItem: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: 12, gap: 12,
  },
  dlIconBox: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center',
  },
  dlName: { fontSize: 14, fontWeight: '600', color: '#111827' },
  dlDate: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  dlSep: { height: 1, backgroundColor: '#F3F4F6' },
  dlLoadingRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, justifyContent: 'center',
  },
  dlLoadingText: { fontSize: 13, color: '#6B7280' },
  dlBrowseBtn: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: '#1E3A5F',
  },
  dlBrowseBtnText: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },
  dlCancelBtn: { marginTop: 10, paddingVertical: 13, alignItems: 'center' },
  dlCancelText: { fontSize: 14, color: '#9CA3AF', fontWeight: '500' },

  // Obra selection modal items
  trocarExcelBtn: {
    marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 11, borderRadius: 10,
    borderWidth: 1.5, borderColor: '#1E3A5F', borderStyle: 'dashed',
  },
  trocarExcelText: { fontSize: 13, fontWeight: '600', color: '#1E3A5F' },
  obraItem: { paddingVertical: 14, paddingHorizontal: 4 },
  obraItemDone: { opacity: 0.7 },
  obraItemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  obraOV: { fontSize: 15, fontWeight: '800', color: '#1E3A5F' },
  obraOVDone: { color: '#9CA3AF' },
  obraDoneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: '#16A34A', borderRadius: 20,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  obraDoneBadgeText: { fontSize: 11, fontWeight: '700', color: '#FFF' },
  obraMunicipio: { fontSize: 13, color: '#374151', marginBottom: 1 },
  obraRef: { fontSize: 12, color: '#6B7280', marginBottom: 4 },
  obraDateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  obraDateTime: { fontSize: 12, color: '#374151', fontWeight: '500' },
});
