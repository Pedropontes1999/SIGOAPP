import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, StatusBar, ScrollView, Alert, Modal,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';
import { MOCK_USERS } from '../data/mockUsers';
import { excelDateToStr, excelTimeToStr } from '../utils/excelDate';

const PARCEIRAS = [...new Set(
  Object.values(MOCK_USERS)
    .filter(u => u.role === 'tercerizado' && u.parceira)
    .map(u => u.parceira)
)].sort();

function hoje() {
  return new Date().toLocaleDateString('pt-BR');
}

export default function FiscalizacaoScreen({ route, navigation }) {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  // Fluxo interno passa uma única equipe (route.params.equipe); fallback para lista
  const equipeUnica = route?.params?.equipe ?? null;
  const equipes = equipeUnica ? [equipeUnica] : (route?.params?.equipes ?? []);
  const obras = equipeUnica?.obras ?? [];

  // Se todas as equipes são da mesma parceira, pré-seleciona automaticamente
  const parceiraComum = equipes.length > 0 && equipes.every(e => e.parceira === equipes[0].parceira)
    ? equipes[0].parceira : '';

  const [parceira,         setParceira]         = useState(parceiraComum);
  const [showParceiraPick, setShowParceiraPick] = useState(false);
  const [data,             setData]             = useState(hoje());
  const [notaOV,           setNotaOV]           = useState('');
  const [tecnicoFiscal,    setTecnicoFiscal]    = useState(user?.nome ?? ''); // pré-preenche com usuário logado
  const [supervisorObra,   setSupervisorObra]   = useState(null);
  const [qtdLM,            setQtdLM]            = useState('');
  const [qtdLV,            setQtdLV]            = useState('');
  const [membros,          setMembros]          = useState({
    'João Alves': false, 'Fernanda Rocha': false, 'Lucas Martins': false,
    'Carla Souza': false, 'Diego Ferreira': false,
  });
  const [equipesCompletas, setEquipesCompletas] = useState(null);

  // Valida campos obrigatórios antes de registrar a inspeção
  function handleEnviar() {
    if (!parceira || !notaOV.trim() || !tecnicoFiscal.trim() ||
        supervisorObra === null || !qtdLM || !qtdLV || equipesCompletas === null) {
      Alert.alert('Atenção', 'Preencha todos os campos obrigatórios (*).');
      return;
    }
    // Navega direto (no React Native Web os callbacks de botão do Alert não disparam)
    // Fluxo interno: marca esta equipe como concluída na lista e volta (goBack
    // preserva a instância da lista com suas equipes). Callback vindo via params.
    route?.params?.onConcluir?.();
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
          <Text style={styles.headerTitle}>Inspeção de Campo</Text>
          <Text style={styles.headerSub}>Execução</Text>
        </View>
        <TouchableOpacity onPress={openSidebar} style={styles.headerBtn}>
          <Text style={styles.headerBtnText}>☰</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={[styles.body, { backgroundColor: colors.bg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.card, { backgroundColor: colors.card }]}>
          <Text style={[styles.formTitle, { color: colors.heading }]}>
            Inspeções de Campo – Execução
          </Text>
          <Text style={[styles.formSub, { color: colors.textMuted }]}>
            Campos com * são obrigatórios.
          </Text>

          {/* Badge com as siglas das equipes que serão inspecionadas */}
          {equipes.length > 0 && (
            <View style={[styles.equipesBadge, { backgroundColor: colors.equipeRowActiveBg }]}>
              <Text style={[styles.equipesBadgeLabel, { color: colors.linkText }]}>
                {equipes.length} equipe{equipes.length > 1 ? 's' : ''} selecionada{equipes.length > 1 ? 's' : ''}:
              </Text>
              <Text style={[styles.equipesBadgeSiglas, { color: colors.heading }]}>
                {equipes.map(e => e.sigla).join(' · ')}
              </Text>
            </View>
          )}

          {/* Dados do Excel — obras desta equipe (fluxo interno) */}
          {equipeUnica && obras.length > 0 && (
            <View style={[styles.obrasBox, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <Text style={[styles.obrasTitle, { color: colors.heading }]}>
                Obras no Excel · {obras.length}
              </Text>
              {obras.map((o, i) => (
                <View key={i} style={[styles.obraLinha, i < obras.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[styles.obraOv, { color: colors.heading }]}>OV {o['OVNOTA'] || '—'}</Text>
                  {!!o['MUNICIPIO'] && <Text style={[styles.obraInfo, { color: colors.text }]}>{o['MUNICIPIO']}</Text>}
                  {!!o['REFERENCIA'] && <Text style={[styles.obraInfo, { color: colors.textMuted }]} numberOfLines={1}>{o['REFERENCIA']}</Text>}
                  <Text style={[styles.obraInfo, { color: colors.textMuted }]}>
                    {excelDateToStr(o['DATAPROG'])} · {excelTimeToStr(o['HORAINI'])} – {excelTimeToStr(o['HORATER'])}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Campo 1: parceira — abre modal de seleção */}
          <Field label="1. Parceira" required colors={colors}>
            <TouchableOpacity
              style={[styles.dropdownBtn, { borderBottomColor: colors.border }]}
              onPress={() => setShowParceiraPick(true)}
              activeOpacity={0.8}
            >
              <Text style={[styles.dropdownText, { color: parceira ? colors.inputText : colors.textMuted }]}>
                {parceira || 'Selecionar sua resposta'}
              </Text>
              <Text style={[styles.dropdownArrow, { color: colors.textMuted }]}>▼</Text>
            </TouchableOpacity>
          </Field>

          <Field label="2. Data" colors={colors}>
            <TextInput
              style={[styles.input, { borderBottomColor: colors.border, color: colors.inputText }]}
              placeholder="dd/MM/aaaa"
              placeholderTextColor={colors.textMuted}
              value={data}
              onChangeText={setData}
            />
          </Field>

          <Field label="3. Número da Nota / OV" required colors={colors}>
            <TextInput
              style={[styles.input, { borderBottomColor: colors.border, color: colors.inputText }]}
              placeholder="Insira sua resposta"
              placeholderTextColor={colors.textMuted}
              value={notaOV}
              onChangeText={setNotaOV}
            />
          </Field>

          <Field label="4. Técnico Fiscal" required colors={colors}>
            <TextInput
              style={[styles.input, { borderBottomColor: colors.border, color: colors.inputText }]}
              placeholder="Insira sua resposta"
              placeholderTextColor={colors.textMuted}
              value={tecnicoFiscal}
              onChangeText={setTecnicoFiscal}
            />
          </Field>

          <Field label="5. Supervisor estava na obra?" required colors={colors}>
            <RadioGroup value={supervisorObra} onChange={setSupervisorObra} options={['Sim', 'Não']} colors={colors} />
          </Field>

          {/* Validação: aceita apenas 0–25 */}
          <Field label="6. Quantas Equipes de LM?" required colors={colors}>
            <TextInput
              style={[styles.input, { borderBottomColor: colors.border, color: colors.inputText }]}
              placeholder="O número deve estar entre 0 – 25"
              placeholderTextColor={colors.textMuted}
              value={qtdLM}
              onChangeText={v => { const n = parseInt(v); if (v === '' || (!isNaN(n) && n >= 0 && n <= 25)) setQtdLM(v); }}
              keyboardType="numeric"
            />
          </Field>

          <Field label="7. Quantas Equipes de LV?" required colors={colors}>
            <TextInput
              style={[styles.input, { borderBottomColor: colors.border, color: colors.inputText }]}
              placeholder="O número deve estar entre 0 – 25"
              placeholderTextColor={colors.textMuted}
              value={qtdLV}
              onChangeText={v => { const n = parseInt(v); if (v === '' || (!isNaN(n) && n >= 0 && n <= 25)) setQtdLV(v); }}
              keyboardType="numeric"
            />
          </Field>

          {/* Membros: toggle de presença por membro */}
          <Field label="8. Membros da equipe" colors={colors}>
            <View style={styles.membrosWrap}>
              {Object.keys(membros).map(nome => (
                <TouchableOpacity
                  key={nome}
                  style={[styles.membroRow, {
                    backgroundColor: membros[nome] ? colors.equipeRowActiveBg : colors.inputBg,
                    borderColor: membros[nome] ? colors.heading : colors.border,
                  }]}
                  onPress={() => setMembros(prev => ({ ...prev, [nome]: !prev[nome] }))}
                  activeOpacity={0.7}
                >
                  <View style={[styles.membroCheck, membros[nome] && styles.membroCheckActive]}>
                    {membros[nome] && <Text style={styles.membroCheckmark}>✓</Text>}
                  </View>
                  <Text style={[styles.membroNome, { color: membros[nome] ? colors.heading : colors.text }]}>
                    {nome}
                  </Text>
                  <Text style={[styles.membroStatus, { color: colors.textMuted }]}>
                    {membros[nome] ? 'Presente' : 'Ausente'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </Field>

          <Field label="9. Equipes completas?" required colors={colors}>
            <RadioGroup value={equipesCompletas} onChange={setEquipesCompletas} options={['Sim', 'Não']} colors={colors} />
          </Field>

          <TouchableOpacity style={styles.enviarBtn} onPress={handleEnviar} activeOpacity={0.85}>
            <Text style={styles.enviarBtnText}>Enviar</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Modal picker de parceira */}
      <Modal visible={showParceiraPick} transparent animationType="fade" onRequestClose={() => setShowParceiraPick(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowParceiraPick(false)}
        >
          <View style={[styles.pickerCard, { backgroundColor: colors.card }]}>
            <Text style={[styles.pickerTitle, { color: colors.textMuted, borderBottomColor: colors.border }]}>
              Selecione a parceira
            </Text>
            {PARCEIRAS.map(p => (
              <TouchableOpacity
                key={p}
                style={[
                  styles.pickerItem,
                  { borderBottomColor: colors.border },
                  parceira === p && { backgroundColor: colors.equipeRowActiveBg },
                ]}
                onPress={() => { setParceira(p); setShowParceiraPick(false); }}
                activeOpacity={0.75}
              >
                <Text style={[styles.pickerItemText, { color: colors.text }, parceira === p && { color: colors.heading, fontWeight: '700' }]}>
                  {p}
                </Text>
                {parceira === p && <Text style={{ color: colors.heading, fontWeight: '800' }}>✓</Text>}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

// Campo reutilizável com label e slot de conteúdo variável
function Field({ label, required, children, colors }) {
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.fieldLabel }]}>
        {label}{required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      {children}
    </View>
  );
}

// Radio group genérico para opções mutuamente exclusivas (Sim/Não)
function RadioGroup({ value, onChange, options, colors }) {
  return (
    <View style={styles.radioGroup}>
      {options.map(opt => (
        <TouchableOpacity key={opt} style={styles.radioRow} onPress={() => onChange(opt)} activeOpacity={0.7}>
          <View style={[styles.radioCircle, { borderColor: colors.radioBorder }, value === opt && { borderColor: '#1E3A5F' }]}>
            {value === opt && <View style={styles.radioDot} />}
          </View>
          <Text style={[styles.radioLabel, { color: colors.radioLabel }]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1E3A5F' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '800', color: '#FFF' },
  headerSub: { fontSize: 11, color: '#93C5FD', marginTop: 1 },
  headerBtn: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
  },
  headerBtnText: { color: '#FFF', fontSize: 13, fontWeight: '600' },

  body: { flexGrow: 1, padding: 16, paddingBottom: 40 },
  card: {
    borderRadius: 16, padding: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  formTitle: { fontSize: 17, fontWeight: '800', marginBottom: 4 },
  formSub: { fontSize: 12, marginBottom: 8 },
  equipesBadge: { borderRadius: 10, padding: 12, marginTop: 4 },
  equipesBadgeLabel: { fontSize: 11, fontWeight: '700', marginBottom: 4 },
  equipesBadgeSiglas: { fontSize: 13, fontWeight: '600' },

  obrasBox: { borderRadius: 10, borderWidth: 1, padding: 12, marginTop: 12 },
  obrasTitle: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  obraLinha: { paddingVertical: 8 },
  obraOv: { fontSize: 13, fontWeight: '800' },
  obraInfo: { fontSize: 12, marginTop: 1 },

  field: { marginTop: 20 },
  fieldLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  required: { color: '#DC2626', fontWeight: '700' },

  input: { borderBottomWidth: 1.5, paddingVertical: 10, fontSize: 14 },
  dropdownBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    borderBottomWidth: 1.5, paddingVertical: 10,
  },
  dropdownText: { fontSize: 14 },
  dropdownArrow: { fontSize: 11 },

  radioGroup: { gap: 12 },
  radioRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioCircle: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#1E3A5F' },
  radioLabel: { fontSize: 14 },

  membrosWrap: { gap: 8, marginTop: 4 },
  membroRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 10, paddingHorizontal: 8,
    borderRadius: 10, borderWidth: 1.5,
  },
  membroCheck: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: '#D1D5DB', justifyContent: 'center', alignItems: 'center',
  },
  membroCheckActive: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  membroCheckmark: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  membroNome: { flex: 1, fontSize: 14, fontWeight: '600' },
  membroStatus: { fontSize: 11, fontWeight: '600' },

  enviarBtn: {
    backgroundColor: '#1E3A5F', borderRadius: 10,
    paddingVertical: 14, alignItems: 'center', marginTop: 32,
  },
  enviarBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  pickerCard: {
    borderRadius: 16, paddingVertical: 8, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  pickerTitle: {
    fontSize: 13, fontWeight: '700',
    paddingHorizontal: 20, paddingVertical: 10,
    borderBottomWidth: 1,
  },
  pickerItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1,
  },
  pickerItemText: { fontSize: 14 },
});
