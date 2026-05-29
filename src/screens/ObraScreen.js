import React, { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, ActivityIndicator, Platform,
} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as XLSX from 'xlsx';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

export default function ObraScreen({ route, navigation }) {
  const { logout } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  const arquivo = route?.params?.arquivo ?? null; // Excel/PDF da obra
  const projeto = route?.params?.projeto ?? null; // PDF do projeto (opcional)

  const [obra, setObra] = useState(null);   // dados da primeira linha do Excel
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState(null);

  // Lê o arquivo assim que chegar via params
  useEffect(() => {
    if (arquivo) parseArquivo(arquivo);
  }, [arquivo]);

  // Lê Excel no web via FileReader ou no nativo via FileSystem + base64
  async function parseArquivo(arq) {
    setLoading(true);
    setErro(null);
    try {
      let rows;
      if (Platform.OS === 'web' && arq.file) {
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
          reader.readAsArrayBuffer(arq.file);
        });
      } else {
        const base64 = await FileSystem.readAsStringAsync(arq.uri, { encoding: FileSystem.EncodingType.Base64 });
        const wb = XLSX.read(base64, { type: 'base64' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      }
      if (rows.length > 0) setObra(rows[0]);
      else setErro('O arquivo não contém dados.');
    } catch {
      setErro('Não foi possível ler o arquivo. Verifique o formato.');
    }
    setLoading(false);
  }

  // Filtra apenas os campos com valor para exibir na tela
  const campos = obra ? [
    { label: 'OV / Nota',             value: obra['OVNOTA'] },
    { label: 'Ordem Diagrama',        value: obra['ORDEMDIAGRAMA'] },
    { label: 'Ordem DCD',             value: obra['ORDEMDCD'] },
    { label: 'Ordem DCA',             value: obra['ORDEMDCA'] },
    { label: 'Ordem DCIM',            value: obra['ORDEMDCIM'] },
    { label: 'Município',             value: obra['MUNICIPIO'] },
    { label: 'Parceira',              value: obra['PARCEIRA'] },
    { label: 'Referência',            value: obra['REFERENCIA'] },
    { label: 'Tipo de Obra',          value: obra['TIPOOBRA'] },
    { label: 'Grupo',                 value: obra['GRUPO'] },
    { label: 'Circuito',              value: obra['CIRCUITO'] },
    { label: 'Status Programação',    value: obra['STATUSPROGRAMACAO'] },
  ].filter(c => c.value !== '' && c.value !== undefined) : [];

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor="#1E3A5F" />

      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Obra</Text>
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
          <View style={styles.fileRow}>
            <Text style={styles.fileIcon}>📄</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                {arquivo?.name}
              </Text>
              <Text style={[styles.fileSize, { color: colors.textMuted }]}>
                {arquivo?.size ? `${(arquivo.size / 1024).toFixed(1)} KB` : ''}
              </Text>
            </View>
          </View>
        </View>

        {loading && (
          <View style={styles.centerBox}>
            <ActivityIndicator size="large" color={colors.timer} />
            <Text style={[styles.loadingText, { color: colors.textSub }]}>Lendo arquivo...</Text>
          </View>
        )}

        {erro && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{erro}</Text>
          </View>
        )}

        {obra && (
          <>
            <View style={[styles.card, { marginTop: 12, backgroundColor: colors.card }]}>
              <Text style={[styles.cardTitle, { color: colors.heading }]}>Informações da Obra</Text>
              {campos.map(({ label, value }, i) => (
                <View
                  key={label}
                  style={[styles.infoRow, { borderBottomColor: colors.infoRowBorder },
                    i === campos.length - 1 && { borderBottomWidth: 0 }]}
                >
                  <Text style={[styles.infoLabel, { color: colors.infoLabel }]}>{label}</Text>
                  <Text style={[styles.infoValue, { color: colors.infoValue }]}>{String(value)}</Text>
                </View>
              ))}
            </View>

            <TouchableOpacity
              style={styles.iniciarBtn}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('Trajeto', { obra, projeto })}
            >
              <Text style={styles.iniciarBtnText}>Iniciar Trajeto</Text>
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 16,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#FFFFFF' },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  body: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  fileIcon: { fontSize: 32 },
  fileName: { fontSize: 14, fontWeight: '600' },
  fileSize: { fontSize: 12, marginTop: 2 },
  centerBox: { alignItems: 'center', paddingVertical: 32, gap: 12 },
  loadingText: { fontSize: 14 },
  errorBox: {
    marginTop: 12, backgroundColor: '#FEF2F2', borderRadius: 12,
    borderWidth: 1, borderColor: '#FECACA', padding: 14,
  },
  errorText: { color: '#DC2626', fontSize: 13 },
  infoRow: { paddingVertical: 10, borderBottomWidth: 1 },
  infoLabel: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', marginBottom: 3 },
  infoValue: { fontSize: 14, fontWeight: '500' },
  iniciarBtn: {
    backgroundColor: '#16A34A', borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 20, elevation: 5,
  },
  iniciarBtnText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: 0.5 },
});
