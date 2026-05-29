import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  Animated, ScrollView, Switch, Platform, Alert, ActivityIndicator,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { loadReports } from '../storage/reports';
import { buildWorkbook } from '../storage/buildWorkbook';

const DRAWER_WIDTH = 310;
const SLIDE_START = -DRAWER_WIDTH;

const OBRA_CAMPOS = [
  { label: 'OV / Nota',         key: 'OVNOTA' },
  { label: 'Município',         key: 'MUNICIPIO' },
  { label: 'Tipo de Obra',      key: 'TIPOOBRA' },
  { label: 'Circuito',          key: 'CIRCUITO' },
  { label: 'Parceira',          key: 'PARCEIRA' },
  { label: 'Referência',        key: 'REFERENCIA' },
  { label: 'Grupo',             key: 'GRUPO' },
  { label: 'Status Prog.',      key: 'STATUSPROGRAMACAO' },
  { label: 'Ordem Diagrama',    key: 'ORDEMDIAGRAMA' },
  { label: 'Ordem DCD',         key: 'ORDEMDCD' },
  { label: 'Ordem DCA',         key: 'ORDEMDCA' },
  { label: 'Ordem DCIM',        key: 'ORDEMDCIM' },
];

export default function Sidebar() {
  const { isOpen, close, obra } = useSidebar();
  const { isDark, toggle } = useTheme();
  const { user } = useAuth();
  const [reports, setReports] = useState([]);
  const [obraExpanded, setObraExpanded] = useState(false);
  const [downloading, setDownloading] = useState(null); // índice do relatório sendo baixado
  const slideAnim = useRef(new Animated.Value(SLIDE_START)).current; // posição X do drawer
  const fadeAnim = useRef(new Animated.Value(0)).current;            // opacidade do backdrop

  // Ao abrir: carrega relatórios e anima entrada; ao fechar: anima saída
  useEffect(() => {
    if (isOpen) {
      loadReports(user?.sigla).then(setReports);
      Animated.parallel([
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 120, friction: 14 }),
        Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, { toValue: SLIDE_START, duration: 220, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0, duration: 180, useNativeDriver: true }),
      ]).start();
    }
  }, [isOpen]);

  // Reconstrói workbook Excel e baixa/compartilha o arquivo do relatório
  async function baixarRelatorio(report, index) {
    setDownloading(index);
    try {
      const dataRelatorio = new Date(report.savedAt);
      const dataStr = dataRelatorio.toLocaleDateString('pt-BR');

      const wb = buildWorkbook(report);
      const sigla = report.user?.sigla ?? 'SIgo';
      const nomeArq = `Relatorio_${sigla}_${dataStr.replace(/\//g, '-')}.xlsx`;

      if (Platform.OS === 'web') {
        XLSX.writeFile(wb, nomeArq);
      } else {
        const base64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
        const path = FileSystem.documentDirectory + nomeArq;
        await FileSystem.writeAsStringAsync(path, base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(path, {
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          dialogTitle: 'Compartilhar Relatório',
          UTI: 'com.microsoft.excel.xlsx',
        });
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o relatório.');
    }
    setDownloading(null);
  }

  // Não renderiza nada enquanto fechado (otimiza performance)
  if (!isOpen) return null;

  // Cores locais do drawer — mais simples que usar ThemeContext completo aqui
  const c = isDark
    ? { drawer: '#1E293B', section: '#0F172A', sectionBorder: '#334155', text: '#F1F5F9', sub: '#94A3B8', muted: '#64748B' }
    : { drawer: '#FFFFFF', section: '#F9FAFB', sectionBorder: '#E5E7EB', text: '#111827', sub: '#6B7280', muted: '#9CA3AF' };

  return (
    <Modal visible transparent animationType="none" onRequestClose={close}>
      <View style={s.overlay}>
        <Animated.View style={[s.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={{ flex: 1 }} onPress={close} activeOpacity={1} />
        </Animated.View>

        <Animated.View style={[s.drawer, { backgroundColor: c.drawer, transform: [{ translateX: slideAnim }] }]}>
          {/* Cabeçalho com dados do usuário */}
          <View style={s.drawerHeader}>
            <View style={{ flex: 1 }}>
              <Text style={s.drawerName}>{user?.nome ?? '—'}</Text>
              <Text style={s.drawerSub}>{user?.sigla}{user?.parceira ? ` · ${user.parceira}` : ''}</Text>
            </View>
            <TouchableOpacity onPress={close} style={s.closeBtn} activeOpacity={0.8}>
              <Text style={s.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>

            {/* ── Aparência ── */}
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: c.sub }]}>APARÊNCIA</Text>
              <View style={[s.optionRow, { backgroundColor: c.section, borderColor: c.sectionBorder }]}>
                <Text style={s.optionIcon}>{isDark ? '☀️' : '🌙'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[s.optionTitle, { color: c.text }]}>
                    {isDark ? 'Modo Claro' : 'Modo Escuro'}
                  </Text>
                  <Text style={[s.optionSub, { color: c.sub }]}>
                    {isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
                  </Text>
                </View>
                <Switch
                  value={isDark}
                  onValueChange={toggle}
                  trackColor={{ false: '#D1D5DB', true: '#3B82F6' }}
                  thumbColor={isDark ? '#FFFFFF' : '#FFFFFF'}
                />
              </View>
            </View>

            {/* ── Dados da Obra ── */}
            {obra && Object.keys(obra).length > 0 && (
              <View style={s.section}>
                <TouchableOpacity
                  style={[s.obraToggle, { backgroundColor: c.section, borderColor: c.sectionBorder }]}
                  onPress={() => setObraExpanded(v => !v)}
                  activeOpacity={0.75}
                >
                  <Text style={[s.sectionLabel, { color: c.sub, marginBottom: 0 }]}>DADOS DA OBRA</Text>
                  <Text style={[s.obraChevron, { color: c.sub }]}>{obraExpanded ? '▲' : '▼'}</Text>
                </TouchableOpacity>
                {obraExpanded && (
                  <View style={[s.obraCard, { backgroundColor: c.section, borderColor: c.sectionBorder }]}>
                    {OBRA_CAMPOS.filter(f => obra[f.key] !== undefined && obra[f.key] !== '').map(f => (
                      <View key={f.key} style={[s.obraRow, { borderBottomColor: c.sectionBorder }]}>
                        <Text style={[s.obraLabel, { color: c.sub }]}>{f.label}</Text>
                        <Text style={[s.obraValue, { color: c.text }]}>{String(obra[f.key])}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* ── Histórico de Relatórios ── */}
            <View style={s.section}>
              <Text style={[s.sectionLabel, { color: c.sub }]}>
                HISTÓRICO DE RELATÓRIOS{reports.length > 0 ? ` (${reports.length})` : ''}
              </Text>

              {reports.length === 0 ? (
                <View style={[s.emptyBox, { backgroundColor: c.section, borderColor: c.sectionBorder }]}>
                  <Text style={{ fontSize: 28, marginBottom: 8 }}>📋</Text>
                  <Text style={[s.emptyText, { color: c.muted }]}>Nenhum relatório ainda.</Text>
                  <Text style={[s.emptyText, { color: c.muted, marginTop: 2 }]}>
                    Gere um relatório na tela de Trajeto.
                  </Text>
                </View>
              ) : (
                reports.map((r, i) => (
                  <View key={i} style={[s.reportCard, { backgroundColor: c.section, borderColor: c.sectionBorder }]}>
                    <View style={{ flex: 1 }}>
                      <Text style={[s.reportTitle, { color: c.text }]}>
                        {r.user?.sigla ?? '—'}{r.obra?.['Ov/Nota'] ? ` · ${r.obra['Ov/Nota']}` : ''}
                      </Text>
                      <Text style={[s.reportDate, { color: c.sub }]}>
                        {new Date(r.savedAt).toLocaleDateString('pt-BR')}{' '}
                        {new Date(r.savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </Text>
                      {(r.obra?.['Municipio'] || r.user?.parceira) ? (
                        <Text style={[s.reportMeta, { color: c.muted }]}>
                          {[r.obra?.['Municipio'], r.user?.parceira].filter(Boolean).join(' · ')}
                        </Text>
                      ) : null}
                    </View>
                    <TouchableOpacity
                      style={[s.downloadBtn, downloading === i && s.downloadBtnLoading]}
                      onPress={() => baixarRelatorio(r, i)}
                      disabled={downloading === i}
                      activeOpacity={0.8}
                    >
                      {downloading === i
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={s.downloadBtnText}>⬇ Baixar</Text>
                      }
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>

          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  overlay: {
    flex: 1, flexDirection: 'row', justifyContent: 'flex-start',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  drawer: {
    width: DRAWER_WIDTH, height: '100%',
    shadowColor: '#000', shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.25, shadowRadius: 16, elevation: 24,
  },
  drawerHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#1E3A5F',
    paddingTop: 52, paddingBottom: 20, paddingHorizontal: 20, gap: 12,
  },
  drawerName: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
  drawerSub: { fontSize: 12, color: '#93C5FD', marginTop: 2 },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    width: 34, height: 34, borderRadius: 17,
    justifyContent: 'center', alignItems: 'center',
  },
  closeBtnText: { color: '#FFF', fontSize: 14, fontWeight: '800' },

  section: { paddingHorizontal: 16, paddingTop: 20, gap: 10 },
  sectionLabel: {
    fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginLeft: 2, marginBottom: 2,
  },

  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 14, borderRadius: 14, borderWidth: 1,
  },
  optionIcon: { fontSize: 22 },
  optionTitle: { fontSize: 14, fontWeight: '700' },
  optionSub: { fontSize: 12, marginTop: 2 },

  emptyBox: {
    borderRadius: 14, borderWidth: 1,
    padding: 24, alignItems: 'center',
  },
  emptyText: { fontSize: 13, textAlign: 'center' },

  reportCard: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    padding: 12, borderRadius: 14, borderWidth: 1,
  },
  reportTitle: { fontSize: 13, fontWeight: '700' },
  reportDate: { fontSize: 11, marginTop: 3 },
  reportMeta: { fontSize: 11, marginTop: 2 },
  obraToggle: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
  },
  obraChevron: { fontSize: 11, fontWeight: '700' },
  obraCard: {
    borderRadius: 12, borderWidth: 1, overflow: 'hidden', marginTop: 6,
  },
  obraRow: {
    paddingVertical: 9, paddingHorizontal: 12, borderBottomWidth: 1,
  },
  obraLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 },
  obraValue: { fontSize: 13, fontWeight: '500' },
  downloadBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    minWidth: 80, alignItems: 'center', justifyContent: 'center',
  },
  downloadBtnLoading: { backgroundColor: '#6B7280' },
  downloadBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
});
