 import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Image, Alert, Platform, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

// Converte serial de tempo do Excel (ex: 25569.395833) para "HH:MM"
function excelTimeToHHMM(serial) {
  if (!serial && serial !== 0) return '—';
  const frac = Number(serial) % 1;
  const totalMin = Math.round(frac * 24 * 60);
  const h = String(Math.floor(totalMin / 60)).padStart(2, '0');
  const m = String(totalMin % 60).padStart(2, '0');
  return `${h}:${m}`;
}

// Converte serial Excel para minutos totais
function excelSerialToMin(serial) {
  if (!serial && serial !== 0) return null;
  return Math.round((Number(serial) % 1) * 24 * 60);
}

// Converte string "HH:MM" para minutos totais; retorna null se inválido
function hhmmToMin(str) {
  const parts = (str ?? '').split(':');
  if (parts.length !== 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (isNaN(h) || isNaN(m)) return null;
  return h * 60 + m;
}

// Formata input para HH:MM — só dígitos, insere ":" após 2 dígitos, clamp 00:00–23:59
function formatHHMM(text) {
  const digits = text.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) {
    const h = parseInt(digits || '0', 10);
    return digits.length === 0 ? '' : String(Math.min(h, 23)).padStart(digits.length === 2 ? 2 : 1, '0');
  }
  const h = Math.min(parseInt(digits.slice(0, 2), 10), 23);
  const m = Math.min(parseInt(digits.slice(2), 10), 59);
  return String(h).padStart(2, '0') + ':' + String(m).padStart(digits.length === 4 ? 2 : 1, '0');
}

// Toggle Sim/Não reutilizável — dois botões exclusivos
function SimNao({ value, onChange }) {
  const { colors } = useTheme();
  return (
    <View style={s.simNaoRow}>
      {['Sim', 'Não'].map(op => (
        <TouchableOpacity
          key={op}
          style={[s.simNaoBtn,
            !(value === op) && { backgroundColor: colors.inputBg, borderColor: colors.border },
            value === op && s.simNaoBtnAtivo]}
          onPress={() => onChange(op)}
        >
          <Text style={[s.simNaoText, { color: value === op ? '#FFF' : colors.textMuted }]}>{op}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function InfoRow({ label, value }) {
  const { colors } = useTheme();
  return (
    <View style={s.infoRow}>
      <Text style={[s.infoLabel, { color: colors.heading }]}>{label}:</Text>
      <Text style={[s.infoValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

// Modal de Desligamento Programado — coleta horários, contatos COI, chave provisória e foto do DP
export default function DPModal({ visible, onClose, onConcluir, obra }) {
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [fotosDP, setFotosDP] = useState([null, null]); // 2 slots: índice 0 obrigatório, 1 opcional
  const [horaInicio, setHoraInicio] = useState('');
  const [horaConclusao, setHoraConclusao] = useState('');
  const [contatoInicioCOI, setContatoInicioCOI] = useState('');
  const [contatoTerminoCOI, setContatoTerminoCOI] = useState('');
  const [justificarAtraso, setJustificarAtraso] = useState('');
  const [chaveProvisoria, setChaveProvisoria] = useState('');
  const [motivoChave, setMotivoChave] = useState('');
  const [refInstalacaoChave, setRefInstalacaoChave] = useState('');
  const [chaveRetirada, setChaveRetirada] = useState('');
  const [refChaveRetirada, setRefChaveRetirada] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [colaboradorEDP, setColaboradorEDP] = useState('');
  const [colaboradorParceira, setColaboradorParceira] = useState('');

  async function anexarFoto(idx) {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à galeria.');
        return;
      }
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (!result.canceled && result.assets?.length > 0) {
      setFotosDP(prev => prev.map((f, i) => i === idx ? result.assets[0].uri : f));
    }
  }

  async function tirarFoto(idx) {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão necessária', 'Autorize o acesso à câmera.');
        return;
      }
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
    if (!result.canceled && result.assets?.length > 0) {
      setFotosDP(prev => prev.map((f, i) => i === idx ? result.assets[0].uri : f));
    }
  }

  function handleConcluir() {
    onConcluir({
      fotosDP, horaInicio, horaConclusao,
      contatoInicioCOI, contatoTerminoCOI, justificarAtraso,
      chaveProvisoria, motivoChave, refInstalacaoChave,
      chaveRetirada, refChaveRetirada,
      observacoes, colaboradorEDP, colaboradorParceira,
    });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>DP — Desligamento Programado</Text>
          <View style={s.headerRight}>
            <TouchableOpacity onPress={openSidebar} style={s.menuBtn}>
              <Text style={s.menuBtnText}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView contentContainerStyle={[s.body, { backgroundColor: colors.bg }]} keyboardShouldPersistTaps="handled">
          <Text style={[s.formTitle, { color: colors.heading }]}>DESLIGAMENTO PROGRAMADO</Text>

          <View style={[s.infoCard, { backgroundColor: colors.equipeRowActiveBg, borderColor: colors.border }]}>
            <InfoRow label="Tipo de Serviço" value={obra?.['TIPOSERVICO'] ?? '—'} />
            <InfoRow label="Num. DP"         value={obra?.['NUMDP'] ?? '—'} />
            <InfoRow label="CHI"             value={obra?.['CHI'] ?? '—'} />
            <InfoRow label="Obs. Programação" value={obra?.['OBSERVPROGRAMACAO'] ?? '—'} />
          </View>

          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.heading }]}>Horários (Prog)</Text>
            <View style={s.row2}>
              <View style={s.metade}>
                <Text style={[s.label, { color: colors.fieldLabel }]}>Hora de Início</Text>
                <View style={[s.inputReadOnly, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[s.inputReadOnlyText, { color: colors.inputText }]}>
                    {excelTimeToHHMM(obra?.['HORAINI'])}
                  </Text>
                </View>
              </View>
              <View style={s.metade}>
                <Text style={[s.label, { color: colors.fieldLabel }]}>Hora de Término</Text>
                <View style={[s.inputReadOnly, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
                  <Text style={[s.inputReadOnlyText, { color: colors.inputText }]}>
                    {excelTimeToHHMM(obra?.['HORATER'])}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.heading }]}>Horários (Real)</Text>
            <View style={s.row2}>
              <View style={s.metade}>
                <Text style={[s.label, { color: colors.fieldLabel }]}>Hora de Início</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                  value={horaInicio} onChangeText={v => setHoraInicio(formatHHMM(v))}
                  placeholder="00:00" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
              <View style={s.metade}>
                <Text style={[s.label, { color: colors.fieldLabel }]}>Hora de Conclusão</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                  value={horaConclusao} onChangeText={v => setHoraConclusao(formatHHMM(v))}
                  placeholder="00:00" placeholderTextColor={colors.textMuted} keyboardType="numeric"
                />
              </View>
            </View>
          </View>

          {(() => {
            const progIni = excelSerialToMin(obra?.['HORAINI']);
            const progTer = excelSerialToMin(obra?.['HORATER']);
            const realIni = hhmmToMin(horaInicio);
            const realCon = hhmmToMin(horaConclusao);
            const temAtraso = progTer !== null && realCon !== null && realCon > progTer;
            if (!temAtraso) return null;
            return (
              <View style={[s.card, { backgroundColor: colors.card, borderLeftWidth: 3, borderLeftColor: '#EF4444' }]}>
                <Text style={[s.cardTitle, { color: '#EF4444' }]}>Justificar Atraso</Text>
                <TextInput
                  style={[s.textArea, { backgroundColor: colors.inputBg, borderColor: '#EF4444', color: colors.inputText }]}
                  value={justificarAtraso} onChangeText={setJustificarAtraso}
                  placeholder="Descreva o motivo do atraso..."
                  placeholderTextColor="#EF4444"
                  multiline numberOfLines={3} textAlignVertical="top"
                />
              </View>
            );
          })()}

          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.heading }]}>Contatos COI</Text>
            <Text style={[s.label, { color: colors.fieldLabel }]}>Contato de Início COI</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
              value={contatoInicioCOI} onChangeText={setContatoInicioCOI}
              placeholder="Nome / código" placeholderTextColor={colors.textMuted}
            />
            <Text style={[s.label, { color: colors.fieldLabel }]}>Contato de Término COI</Text>
            <TextInput
              style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
              value={contatoTerminoCOI} onChangeText={setContatoTerminoCOI}
              placeholder="Nome / código" placeholderTextColor={colors.textMuted}
            />
          </View>

          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.heading }]}>Chave Provisória</Text>
            <Text style={[s.label, { color: colors.fieldLabel }]}>Houve instalação de chave provisória?</Text>
            <SimNao value={chaveProvisoria} onChange={setChaveProvisoria} />

            {chaveProvisoria === 'Sim' && (
              <>
                <Text style={[s.label, { color: colors.fieldLabel }]}>Motivo</Text>
                <TextInput
                  style={[s.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                  value={motivoChave} onChangeText={setMotivoChave}
                  placeholder="Informe o motivo..."
                  placeholderTextColor={colors.textMuted}
                  multiline numberOfLines={3} textAlignVertical="top"
                />
                <Text style={[s.label, { color: colors.fieldLabel }]}>Qual a referência de instalação da chave provisória?</Text>
                <TextInput
                  style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                  value={refInstalacaoChave} onChangeText={setRefInstalacaoChave}
                  placeholder="Ex: CH-001" placeholderTextColor={colors.textMuted}
                />
                <Text style={[s.label, { color: colors.fieldLabel }]}>Chave provisória foi retirada?</Text>
                <SimNao value={chaveRetirada} onChange={setChaveRetirada} />

                {chaveRetirada === 'Sim' && (
                  <>
                    <Text style={[s.label, { color: colors.fieldLabel }]}>Qual a referência da chave provisória retirada?</Text>
                    <TextInput
                      style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                      value={refChaveRetirada} onChangeText={setRefChaveRetirada}
                      placeholder="Ex: CH-001" placeholderTextColor={colors.textMuted}
                    />
                  </>
                )}
              </>
            )}
          </View>

          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.heading }]}>Observações</Text>
            <TextInput
              style={[s.textArea, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
              value={observacoes} onChangeText={setObservacoes}
              placeholder="Observações gerais..."
              placeholderTextColor={colors.textMuted}
              multiline numberOfLines={3} textAlignVertical="top"
            />
          </View>

          <View style={[s.card, { backgroundColor: colors.card }]}>
            <Text style={[s.cardTitle, { color: colors.heading }]}>Documento DP</Text>
            <Text style={[s.hint, { color: colors.textMuted }]}>Tire uma foto ou selecione a imagem do DP</Text>
            {[0, 1].map(idx => {
              const uri = fotosDP[idx];
              const obrig = idx === 0;
              return (
                <View key={idx} style={s.fotoSlot}>
                  <View style={s.fotoSlotHeader}>
                    <Text style={[s.fotoSlotLabel, { color: colors.fieldLabel }]}>
                      Foto {idx + 1}
                    </Text>
                    {obrig
                      ? <Text style={s.fotoSlotObrig}>Obrigatória</Text>
                      : <Text style={s.fotoSlotOpcional}>Opcional</Text>
                    }
                  </View>
                  {uri ? (
                    <View style={s.fotoContainer}>
                      <Image source={{ uri }} style={s.fotoDP} resizeMode="contain" />
                      <TouchableOpacity style={s.fotoRemoveBtn} onPress={() => setFotosDP(prev => prev.map((f, i) => i === idx ? null : f))}>
                        <Text style={s.fotoRemoveText}>Remover</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[s.fotoOpcao, { backgroundColor: colors.inputBg, borderColor: obrig ? '#EF4444' : colors.border }]}
                      onPress={() => Alert.alert(
                        'Adicionar foto',
                        'Como deseja adicionar a foto?',
                        [
                          { text: 'Câmera', onPress: () => tirarFoto(idx) },
                          { text: 'Galeria', onPress: () => anexarFoto(idx) },
                          { text: 'Cancelar', style: 'cancel' },
                        ]
                      )}
                    >
                      <Text style={[s.fotoOpcaoText, { color: obrig ? '#EF4444' : colors.textMuted }]}>
                        + Adicionar foto
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </View>

          <TouchableOpacity style={s.concluirBtn} onPress={handleConcluir}>
            <Text style={s.concluirText}>Concluir DP</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    backgroundColor: '#1E3A5F', flexDirection: 'row',
    alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  headerTitle: { color: '#FFF', fontSize: 15, fontWeight: '800', flex: 1 },
  headerRight: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  menuBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', width: 32, height: 32,
    borderRadius: 8, justifyContent: 'center', alignItems: 'center',
  },
  menuBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', width: 32, height: 32,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#FFF', fontSize: 16, fontWeight: '800' },
  body: { padding: 16, paddingBottom: 40 },
  formTitle: { fontSize: 13, fontWeight: '800', textAlign: 'center', marginBottom: 14, letterSpacing: 0.5 },
  infoCard: { borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1 },
  infoRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  infoLabel: { fontSize: 12, fontWeight: '700' },
  infoValue: { fontSize: 12, flex: 1 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  hint: { fontSize: 12, marginBottom: 12 },
  row2: { flexDirection: 'row', gap: 8 },
  metade: { flex: 1 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  textArea: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13, minHeight: 80 },
  simNaoRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  simNaoBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  simNaoBtnAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  simNaoText: { fontSize: 13, fontWeight: '700' },
  fotoSlot: { marginBottom: 12 },
  fotoSlotHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  fotoSlotLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  fotoSlotObrig: { fontSize: 11, fontWeight: '600', color: '#EF4444' },
  fotoSlotOpcional: { fontSize: 11, fontWeight: '600', color: '#9CA3AF' },
  fotoContainer: { alignItems: 'center' },
  fotoDP: { width: '100%', height: 200, borderRadius: 8, marginBottom: 8 },
  fotoRemoveBtn: { paddingVertical: 7, paddingHorizontal: 16, borderWidth: 1.5, borderColor: '#EF4444', borderRadius: 8 },
  fotoRemoveText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
  fotoOpcao: {
    borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10,
    justifyContent: 'center', alignItems: 'center', paddingVertical: 18,
  },
  fotoOpcaoText: { fontSize: 13, fontWeight: '700' },
  inputReadOnly: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8,
  },
  inputReadOnlyText: { fontSize: 13, fontWeight: '700' },
  concluirBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  concluirText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
