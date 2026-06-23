import React, { useState, useMemo } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { MOCK_USERS } from '../data/mockUsers';
import { saveObrasList, clearCompletedObras } from '../storage/session';

// Agrupa as obras do Excel por sigla de equipe (SiglaWPA) e enriquece com o cadastro
function agruparPorEquipe(rows) {
  const map = new Map();
  for (const row of rows) {
    const sigla = String(row['SiglaWPA'] ?? '').trim();
    if (!sigla) continue;
    if (!map.has(sigla)) map.set(sigla, []);
    map.get(sigla).push(row);
  }
  return [...map.entries()]
    .map(([sigla, obras]) => {
      const cad = MOCK_USERS[sigla] ?? {};
      return {
        sigla,
        obras,
        parceira:   cad.parceira   ?? '',
        tipoEquipe: cad.tipoEquipe ?? '',
        composicao: cad.composicao ?? '',
        nome:       cad.nome       ?? '',
      };
    })
    .sort((a, b) => a.sigla.localeCompare(b.sigla));
}

export default function ImportInternoScreen({ navigation }) {
  const { user, logout } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();

  const [arquivo, setArquivo]       = useState(null);
  const [projeto, setProjeto]       = useState(null);
  const [loading, setLoading]       = useState(false);
  const [erro, setErro]             = useState(null);
  const [equipes, setEquipes]       = useState([]);
  const [selecionadas, setSelecionadas] = useState(new Set());

  const totalObras = useMemo(
    () => equipes.reduce((acc, e) => acc + e.obras.length, 0),
    [equipes]
  );
  const todasSelecionadas = equipes.length > 0 && equipes.every(e => selecionadas.has(e.sigla));

  // Lê o Excel SEM filtrar por sigla — o interno fiscaliza todas as equipes
  async function processExcel(asset) {
    const { uri, name, file } = asset ?? {};
    setLoading(true);
    setErro(null);
    try {
      let rows;
      if (Platform.OS === 'web' && file) {
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

      const grupos = agruparPorEquipe(rows);
      if (grupos.length === 0) {
        setErro('Nenhuma equipe encontrada no arquivo (coluna SiglaWPA vazia).');
        setArquivo(null);
        setEquipes([]);
        setSelecionadas(new Set());
        return;
      }

      // Persiste todas as obras (não filtradas) e reseta as concluídas
      const todasObras = grupos.flatMap(g => g.obras);
      await saveObrasList(todasObras);
      await clearCompletedObras();

      setArquivo({ uri, name });
      setEquipes(grupos);
      setSelecionadas(new Set(grupos.map(g => g.sigla))); // começa com todas marcadas
    } catch {
      setErro('Não foi possível ler o arquivo. Verifique o formato.');
    } finally {
      setLoading(false);
    }
  }

  async function pickExcel() {
    const result = await DocumentPicker.getDocumentAsync({
      type: [
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      ],
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      await processExcel(result.assets[0]);
    }
  }

  async function pickProjeto() {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/pdf',
      copyToCacheDirectory: true,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setProjeto(result.assets[0]);
    }
  }

  function toggleSigla(sigla) {
    setSelecionadas(prev => {
      const next = new Set(prev);
      next.has(sigla) ? next.delete(sigla) : next.add(sigla);
      return next;
    });
  }

  function toggleTodas() {
    setSelecionadas(todasSelecionadas ? new Set() : new Set(equipes.map(e => e.sigla)));
  }

  function handleContinuar() {
    const equipesParaFiscalizar = equipes.filter(e => selecionadas.has(e.sigla));
    navigation.navigate('TrajetoInterno', {
      equipes: equipesParaFiscalizar,
      projeto,
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
          <Text style={styles.headerTitle}>Importar arquivos</Text>
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

      <ScrollView
        contentContainerStyle={[styles.body, { backgroundColor: colors.bg }, selecionadas.size > 0 && { paddingBottom: 90 }]}
        keyboardShouldPersistTaps="handled"
      >
        {/* Importação */}
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>Nota / Ordem de Trabalho</Text>
          <Text style={[styles.sub, { color: colors.equipeSub }]}>Excel com as obras de todas as equipes</Text>
          <TouchableOpacity
            style={[styles.pickBtn, arquivo && !erro && styles.pickBtnDone]}
            onPress={pickExcel}
            disabled={loading}
            activeOpacity={0.8}
          >
            <Feather name="file-text" size={18} color={arquivo && !erro ? '#16A34A' : '#6B7280'} />
            <Text style={styles.pickBtnText} numberOfLines={1}>
              {loading ? 'Processando...' : arquivo ? arquivo.name : 'Escolher Excel'}
            </Text>
            {loading && <ActivityIndicator size="small" color="#1E3A5F" />}
          </TouchableOpacity>
          {erro && <Text style={styles.erro}>{erro}</Text>}

          <Text style={[styles.sectionLabel, { color: colors.sectionLabel, marginTop: 16 }]}>Projeto (PDF)</Text>
          <Text style={[styles.sub, { color: colors.equipeSub }]}>PDF do projeto da obra</Text>
          <TouchableOpacity
            style={[styles.pickBtn, projeto && styles.pickBtnDone]}
            onPress={pickProjeto}
            activeOpacity={0.8}
          >
            <Feather name="file" size={18} color={projeto ? '#16A34A' : '#6B7280'} />
            <Text style={styles.pickBtnText} numberOfLines={1}>
              {projeto ? projeto.name : 'Escolher PDF'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Equipes encontradas no Excel (todas — sem filtro) */}
        {equipes.length > 0 && (
          <View style={[styles.card, { marginTop: 12, backgroundColor: colors.card }]}>
            <View style={styles.equipesHeader}>
              <Text style={[styles.sectionLabel, { color: colors.sectionLabel }]}>
                Equipes no Excel
                <Text style={{ color: colors.heading, fontWeight: '800' }}> {equipes.length}</Text>
                <Text style={{ color: colors.equipeSub, fontWeight: '600' }}>  ·  {totalObras} obras</Text>
              </Text>
              <TouchableOpacity onPress={toggleTodas} activeOpacity={0.7}>
                <Text style={[styles.selecionarTodas, { color: colors.linkText }]}>
                  {todasSelecionadas ? 'Desmarcar todas' : 'Selecionar todas'}
                </Text>
              </TouchableOpacity>
            </View>

            {equipes.map((e, idx) => {
              const isSelected = selecionadas.has(e.sigla);
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
                      {e.parceira || 'Parceira não identificada'}
                    </Text>
                    <Text style={[styles.equipeSub, { color: colors.equipeSub }]}>
                      {[e.tipoEquipe, e.composicao].filter(Boolean).join(' · ') || '—'}
                      {`  ·  ${e.obras.length} obra${e.obras.length > 1 ? 's' : ''}`}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      {selecionadas.size > 0 && (
        <View style={[styles.footer, { backgroundColor: colors.footerBg, borderTopColor: colors.footerBorder }]}>
          <TouchableOpacity style={styles.footerBtn} onPress={handleContinuar} activeOpacity={0.85}>
            <Text style={styles.footerBtnText}>
              Continuar · {selecionadas.size} equipe{selecionadas.size > 1 ? 's' : ''}
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
  sub: { fontSize: 12, marginTop: 2, marginBottom: 8 },

  pickBtn: {
    borderWidth: 2, borderColor: '#E5E7EB', borderStyle: 'dashed',
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 12,
    alignItems: 'center', flexDirection: 'row', gap: 8, backgroundColor: '#F9FAFB',
  },
  pickBtnDone: { borderColor: '#16A34A', borderStyle: 'solid', backgroundColor: '#F0FDF4' },
  pickBtnText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },
  erro: { fontSize: 12, color: '#DC2626', marginTop: 6 },

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
