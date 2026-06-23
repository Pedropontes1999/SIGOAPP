import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, SafeAreaView,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

// Tipos de equipamento e seus prefixos de instalação (replicado do Sigo)
const EQUIPMENTS = ['Banco capacitor', 'Transformador', 'Religador', 'Regulador de tensão'];

const PREFIXES = {
  Transformador: 'ET',
  'Banco capacitor': 'BC',
  'Regulador de tensão': 'RV',
  Religador: 'RE',
};

// Opções de potência por tipo de equipamento (replicado do Sigo)
const POWER_OPTIONS = {
  'Banco capacitor': ['300', '600', '1200'],
  Transformador: ['1,5', '5', '10', '15', '25', '30', '45', '50', '75', '100', '112.5', '150', '225', '300', '500'],
  Religador: ['0'],
  'Regulador de tensão': ['167', '333'],
};

// Marcas para equipamentos do tipo CS
const CS_BRANDS = ['Landis Gyr', 'Eletra', 'Nansen'];

// Estrutura de um ponto — sem dados fixos, equipamentos entram via "Adicionar"
const novoPonto = (numero = '') => ({
  numero: String(numero),
  possuiAplicados: 'Não',
  aplicados: [],
  possuiRemovidos: 'Não',
  removidos: [],
});

// Estrutura de um equipamento (DEFAULT ou CS, igual ao Sigo)
const novoEquip = (type = 'DEFAULT') => ({
  equipment: '', power: '', patrimony: '', installation: '', type,
});

// Valor exibido para "Número de Instalação" — prefixa conforme o equipamento
function installationDisplay(eq) {
  const pfx = PREFIXES[eq.equipment];
  if (pfx) return eq.installation?.startsWith(pfx) ? eq.installation : pfx + (eq.installation || '');
  return eq.installation;
}

function SimNao({ value, onChange }) {
  const { colors } = useTheme();
  return (
    <View style={s.simNaoRow}>
      {['Sim', 'Não'].map(op => (
        <TouchableOpacity key={op} style={s.checkOpcao} onPress={() => onChange(op)}>
          <View style={[s.checkBox,
            !(value === op) && { backgroundColor: colors.inputBg, borderColor: colors.border },
            value === op && s.checkBoxAtivo]}>
            {value === op && <Text style={s.checkMark}>✓</Text>}
          </View>
          <Text style={[s.checkLabel, { color: colors.text }]}>{op}</Text>
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

// Dropdown reutilizável (substitui o <Select> do Sigo no React Native)
function Dropdown({ value, options, onSelect, placeholder }) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <>
      <TouchableOpacity
        style={[s.input, s.dropdown, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text style={{ color: value ? colors.inputText : colors.textMuted, fontSize: 13 }} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Text style={{ color: colors.textMuted, fontSize: 11 }}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <TouchableOpacity style={s.ddOverlay} activeOpacity={1} onPress={() => setOpen(false)}>
          <View style={[s.ddCard, { backgroundColor: colors.card }]}>
            <ScrollView>
              {options.length === 0 && (
                <Text style={[s.ddEmpty, { color: colors.textMuted }]}>
                  Selecione o equipamento primeiro
                </Text>
              )}
              {options.map(opt => (
                <TouchableOpacity
                  key={opt}
                  style={[s.ddItem, { borderBottomColor: colors.border }]}
                  onPress={() => { onSelect(opt); setOpen(false); }}
                >
                  <Text style={[s.ddItemText, { color: colors.text }, value === opt && { color: colors.heading, fontWeight: '800' }]}>
                    {opt}
                  </Text>
                  {value === opt && <Text style={{ color: colors.heading, fontWeight: '800' }}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

// Modal de Ficha de Equipamento — registra equipamentos aplicados/removidos por ponto (padrão Sigo)
export default function FichaEquipamentoModal({ visible, onClose, onConcluir, obra, pontosProgramados = [] }) {
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [pontos, setPontos] = useState([]);
  const [showPicker, setShowPicker] = useState(false);
  const [colaboradorEDP, setColaboradorEDP] = useState('');
  const [colaboradorParceira, setColaboradorParceira] = useState('');

  // Pontos programados do Excel ainda não adicionados
  const numerosJaAdicionados = pontos.map(p => p.numero);
  const pontosDisponiveis = pontosProgramados.filter(p => !numerosJaAdicionados.includes(String(p)));

  function adicionarPonto(numero) {
    setPontos(p => [...p, novoPonto(numero)]);
    setShowPicker(false);
  }

  function updatePonto(idx, field, value) {
    setPontos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  // ── Equipamentos (lista = 'aplicados' | 'removidos') ──
  function updateEquip(pontoIdx, lista, equipIdx, field, value) {
    setPontos(prev => prev.map((p, i) => {
      if (i !== pontoIdx) return p;
      const arr = [...p[lista]];
      arr[equipIdx] = { ...arr[equipIdx], [field]: value };
      return { ...p, [lista]: arr };
    }));
  }

  // Seleciona o equipamento e zera a potência (as opções dependem do tipo)
  function selecionarEquipamento(pontoIdx, lista, equipIdx, value) {
    setPontos(prev => prev.map((p, i) => {
      if (i !== pontoIdx) return p;
      const arr = [...p[lista]];
      arr[equipIdx] = { ...arr[equipIdx], equipment: value, power: '' };
      return { ...p, [lista]: arr };
    }));
  }

  // Adiciona equipamento DEFAULT no fim, ou CS logo após insertIndex
  function addEquip(pontoIdx, lista, type = 'DEFAULT', insertIndex) {
    setPontos(prev => prev.map((p, i) => {
      if (i !== pontoIdx) return p;
      const novo = novoEquip(type);
      const arr = insertIndex === undefined
        ? [...p[lista], novo]
        : [...p[lista].slice(0, insertIndex + 1), novo, ...p[lista].slice(insertIndex + 1)];
      return { ...p, [lista]: arr };
    }));
  }

  function removeEquip(pontoIdx, lista, equipIdx) {
    setPontos(prev => prev.map((p, i) =>
      i === pontoIdx ? { ...p, [lista]: p[lista].filter((_, j) => j !== equipIdx) } : p
    ));
  }

  function handleConcluir() {
    onConcluir({ pontos, colaboradorEDP, colaboradorParceira });
    onClose();
  }

  // Renderiza a lista de equipamentos (aplicados ou removidos) de um ponto
  function renderEquipList(pontoIdx, lista, label) {
    const ponto = pontos[pontoIdx];
    const inp = [s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }];
    const lbl = [s.label, { color: colors.fieldLabel }];
    return (
      <>
        {ponto[lista].map((eq, equipIdx) => {
          const isCS = eq.type === 'CS';
          const powerOptions = isCS ? CS_BRANDS : (POWER_OPTIONS[eq.equipment] || []);
          return (
            <View key={equipIdx} style={[s.equipCard, { backgroundColor: colors.inputBg, borderColor: colors.border }]}>
              <View style={s.cardHeader}>
                <Text style={[s.equipTitle, { color: colors.heading }]}>
                  {isCS ? 'CS' : `Equipamento ${equipIdx + 1}`}
                </Text>
                <TouchableOpacity onPress={() => removeEquip(pontoIdx, lista, equipIdx)}>
                  <Text style={s.remover}>Remover</Text>
                </TouchableOpacity>
              </View>

              {/* Equipamento / Número CS (ID) */}
              {isCS ? (
                <>
                  <Text style={lbl}>Número CS (ID)</Text>
                  <TextInput
                    style={inp}
                    value={eq.equipment?.startsWith('CS') ? eq.equipment : 'CS' + (eq.equipment || '')}
                    onChangeText={v => updateEquip(pontoIdx, lista, equipIdx, 'equipment', v)}
                    placeholder="CS..." placeholderTextColor={colors.textMuted} autoCapitalize="characters"
                  />
                </>
              ) : (
                <>
                  <Text style={lbl}>Equipamento</Text>
                  <Dropdown
                    value={eq.equipment}
                    options={EQUIPMENTS}
                    placeholder="Selecionar"
                    onSelect={v => selecionarEquipamento(pontoIdx, lista, equipIdx, v)}
                  />
                </>
              )}

              {/* Número de Instalação */}
              <Text style={lbl}>Número de Instalação</Text>
              <TextInput
                style={inp}
                value={installationDisplay(eq)}
                onChangeText={v => updateEquip(pontoIdx, lista, equipIdx, 'installation', v)}
                placeholder="Número de Instalação" placeholderTextColor={colors.textMuted}
              />

              {/* Potência / Marca CS */}
              <Text style={lbl}>{isCS ? 'Marca CS' : 'Potência'}</Text>
              <Dropdown
                value={eq.power}
                options={powerOptions}
                placeholder={isCS ? 'Selecionar marca' : 'Selecionar potência'}
                onSelect={v => updateEquip(pontoIdx, lista, equipIdx, 'power', v)}
              />

              {/* Patrimônio / Número de série — só números, máx 8 dígitos */}
              <Text style={lbl}>{isCS ? 'Número de série' : 'Patrimônio'}</Text>
              <TextInput
                style={inp}
                value={eq.patrimony}
                onChangeText={v => updateEquip(pontoIdx, lista, equipIdx, 'patrimony', v.replace(/\D/g, '').slice(0, 8))}
                placeholder={isCS ? 'Número de série' : 'Patrimônio'} placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              {/* Adicionar CS — apenas para Transformador (insere logo após este) */}
              {eq.equipment === 'Transformador' && (
                <TouchableOpacity
                  style={[s.addCsBtn, { borderColor: colors.heading }]}
                  onPress={() => addEquip(pontoIdx, lista, 'CS', equipIdx)}
                >
                  <Text style={[s.addCsText, { color: colors.heading }]}>+ Adicionar CS</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}

        <TouchableOpacity
          style={[s.addBtn, { borderColor: colors.heading }]}
          onPress={() => addEquip(pontoIdx, lista, 'DEFAULT')}
        >
          <Text style={[s.addBtnText, { color: colors.heading }]}>+ Adicionar {label}</Text>
        </TouchableOpacity>
      </>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Ficha Equipamento</Text>
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
          <Text style={[s.formTitle, { color: colors.heading }]}>FICHA DE EQUIPAMENTO</Text>
          <Text style={[s.formSubtitle, { color: colors.textMuted }]}>(RE, RV, BC E ESTAÇÃO TRANSFORMADORA)</Text>

          <View style={[s.infoCard, { backgroundColor: colors.equipeRowActiveBg, borderColor: colors.border }]}>
            <InfoRow label="Nota / OV" value={obra?.['OVNOTA'] ?? '—'} />
            <InfoRow label="Tipo de Obra" value={obra?.['TIPOOBRA'] ?? '—'} />
            <InfoRow label="Empreiteira" value={obra?.['PARCEIRA'] ?? '—'} />
          </View>

          {pontos.map((ponto, idx) => (
            <View key={idx} style={[s.card, { backgroundColor: colors.card }]}>
              <View style={s.cardHeader}>
                <Text style={[s.cardTitle, { color: colors.heading }]}>
                  {ponto.numero ? `Ponto ${ponto.numero}` : `Ponto ${idx + 1}`}
                </Text>
                <TouchableOpacity onPress={() => setPontos(p => p.filter((_, i) => i !== idx))}>
                  <Text style={s.remover}>Remover</Text>
                </TouchableOpacity>
              </View>

              {/* Número do Ponto */}
              <Text style={[s.label, { color: colors.fieldLabel }]}>Número do Ponto</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                value={ponto.numero}
                onChangeText={v => updatePonto(idx, 'numero', v)}
                placeholder="Ex: 1" placeholderTextColor={colors.textMuted} keyboardType="numeric"
              />

              {/* Possui equipamentos aplicados? */}
              <Text style={[s.pergunta, { color: colors.text }]}>Possui equipamentos aplicados?</Text>
              <SimNao value={ponto.possuiAplicados} onChange={v => updatePonto(idx, 'possuiAplicados', v)} />
              {ponto.possuiAplicados === 'Sim' && renderEquipList(idx, 'aplicados', 'equipamento aplicado')}

              <View style={[s.divisor, { backgroundColor: colors.border }]} />

              {/* Possui equipamentos removidos? */}
              <Text style={[s.pergunta, { color: colors.text }]}>Possui equipamentos removidos?</Text>
              <SimNao value={ponto.possuiRemovidos} onChange={v => updatePonto(idx, 'possuiRemovidos', v)} />
              {ponto.possuiRemovidos === 'Sim' && renderEquipList(idx, 'removidos', 'equipamento removido')}
            </View>
          ))}

          {pontos.length === 0 && !showPicker && (
            <Text style={[s.emptyHint, { color: colors.textMuted }]}>
              Nenhum ponto adicionado. Toque em "+ Adicionar Ponto" para selecionar o ponto programado.
            </Text>
          )}

          {/* Seletor de ponto programado (números vindos do Excel) */}
          {showPicker && (
            <View style={[s.pickerCard, { backgroundColor: colors.card }]}>
              <Text style={[s.pickerTitle, { color: colors.heading }]}>Ponto Programado</Text>
              {pontosDisponiveis.map(p => (
                <TouchableOpacity key={p} style={[s.pickerItem, { borderColor: colors.border }]} onPress={() => adicionarPonto(p)}>
                  <Text style={[s.pickerItemText, { color: colors.text }]}>{p}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[s.pickerItem, s.pickerItemNovo, { borderColor: colors.border }]}
                onPress={() => adicionarPonto('')}
              >
                <Text style={s.pickerItemNovoText}>+ Novo ponto</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPicker(false)} style={s.pickerCancelar}>
                <Text style={[s.pickerCancelarText, { color: colors.textMuted }]}>Cancelar</Text>
              </TouchableOpacity>
            </View>
          )}

          {!showPicker && (
            <TouchableOpacity style={[s.addBtn, { borderColor: colors.heading }]} onPress={() => setShowPicker(true)}>
              <Text style={[s.addBtnText, { color: colors.heading }]}>+ Adicionar Ponto</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity style={s.concluirBtn} onPress={handleConcluir}>
            <Text style={s.concluirText}>Concluir Ficha</Text>
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
  formTitle: { fontSize: 13, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  formSubtitle: { fontSize: 11, textAlign: 'center', marginBottom: 14 },
  infoCard: { borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1 },
  infoRow: { flexDirection: 'row', gap: 6, marginBottom: 4 },
  infoLabel: { fontSize: 12, fontWeight: '700' },
  infoValue: { fontSize: 12, flex: 1 },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  cardTitle: { fontSize: 14, fontWeight: '800', marginBottom: 4 },
  remover: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  pergunta: { fontSize: 13, fontWeight: '700', marginTop: 12, marginBottom: 6 },
  label: { fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  divisor: { height: 1, marginVertical: 14 },

  equipCard: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 10 },
  equipTitle: { fontSize: 13, fontWeight: '800' },

  addBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 10, marginBottom: 4 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  addCsBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 8, paddingVertical: 8, alignItems: 'center', marginTop: 10 },
  addCsText: { fontSize: 12, fontWeight: '700' },

  emptyHint: { fontSize: 12, textAlign: 'center', marginBottom: 10, fontStyle: 'italic' },
  pickerCard: {
    borderRadius: 12, padding: 14, marginBottom: 12, marginTop: 4, elevation: 3,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6,
  },
  pickerTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', marginBottom: 10, letterSpacing: 0.4 },
  pickerItem: {
    borderWidth: 1, borderRadius: 8, paddingVertical: 10,
    paddingHorizontal: 14, marginBottom: 6, alignItems: 'center',
  },
  pickerItemText: { fontSize: 15, fontWeight: '700' },
  pickerItemNovo: { borderStyle: 'dashed' },
  pickerItemNovoText: { fontSize: 14, fontWeight: '700', color: '#1E3A5F' },
  pickerCancelar: { alignItems: 'center', paddingVertical: 8, marginTop: 2 },
  pickerCancelarText: { fontSize: 13, fontWeight: '600' },

  simNaoRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  checkOpcao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkBox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  checkBoxAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  checkMark: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  checkLabel: { fontSize: 13, fontWeight: '500' },

  // Dropdown modal
  ddOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: 32,
  },
  ddCard: {
    borderRadius: 14, paddingVertical: 6, width: '100%', maxHeight: '70%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2, shadowRadius: 20, elevation: 10,
  },
  ddItem: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: 1,
  },
  ddItemText: { fontSize: 15, fontWeight: '600' },
  ddEmpty: { fontSize: 13, textAlign: 'center', padding: 18, fontStyle: 'italic' },

  concluirBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  concluirText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
