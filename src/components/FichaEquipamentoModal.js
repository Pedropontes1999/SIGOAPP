import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Image, Alert, Platform, SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

// Fases usadas na grade de tensão do transformador
const FASES_TENSAO = ['NA', 'NB', 'NC', 'AB', 'AC', 'BC'];

// Retorna estrutura vazia para um novo ponto de equipamento
const novoPonto = () => ({
  numero: '',
  possuiAplicados: 'Não',
  instalado: { potencia: '', patrimonio: '', faseInstalacao: '', serie: '', marca: '', anoFabricacao: '', nInstalacao: '' },
  tensoes: { NA: '', NB: '', NC: '', AB: '', AC: '', BC: '' },
  fotosInstalado: [null, null],
  possuiRemovidos: 'Não',
  retirado: { potencia: '', patrimonio: '', serie: '', marca: '', anoFabricacao: '', nInstalacao: '' },
  fotosRetirado: [null, null],
});

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

// Modal de Ficha de Equipamento — registra transformadores instalados e retirados por ponto
export default function FichaEquipamentoModal({ visible, onClose, onConcluir, obra }) {
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [pontos, setPontos] = useState([novoPonto()]);
  const [colaboradorEDP, setColaboradorEDP] = useState('');
  const [colaboradorParceira, setColaboradorParceira] = useState('');

  // Atualiza um campo de topo do ponto (numero, possuiAplicados, possuiRemovidos…)
  function updatePonto(idx, field, value) {
    setPontos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }
  // Atualiza um campo dentro de uma sub-seção do ponto (instalado, retirado, tensoes)
  function updateSub(idx, secao, field, value) {
    setPontos(prev => prev.map((p, i) => {
      if (i !== idx) return p;
      return { ...p, [secao]: { ...p[secao], [field]: value } };
    }));
  }

  // Abre galeria e salva URI na posição correta do array de fotos do ponto
  async function anexarFoto(pontoIdx, campo, fotoIdx) {
    if (Platform.OS !== 'web') {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permissão necessária', 'Autorize o acesso à galeria.'); return; }
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (!result.canceled && result.assets?.length > 0) {
      setPontos(prev => prev.map((p, i) => {
        if (i !== pontoIdx) return p;
        const f = [...p[campo]]; f[fotoIdx] = result.assets[0].uri;
        return { ...p, [campo]: f };
      }));
    }
  }
  // Remove foto de um slot específico (seta null, mantém os outros slots)
  function removerFoto(pontoIdx, campo, fotoIdx) {
    setPontos(prev => prev.map((p, i) => {
      if (i !== pontoIdx) return p;
      const f = [...p[campo]]; f[fotoIdx] = null;
      return { ...p, [campo]: f };
    }));
  }

  // Entrega dados ao TrajetoScreen e fecha o modal
  function handleConcluir() {
    onConcluir({ pontos, colaboradorEDP, colaboradorParceira });
    onClose();
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
            <InfoRow label="Nota / OV" value={obra?.['Ov/Nota'] ?? '—'} />
            <InfoRow label="Tipo de Obra" value={obra?.['Tipo'] ?? '—'} />
            <InfoRow label="Empreiteira" value={obra?.['Empreiteira'] ?? '—'} />
          </View>

          {pontos.map((ponto, idx) => {
            const inp = [s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }];
            const lbl = [s.label, { color: colors.fieldLabel }];
            return (
              <View key={idx} style={[s.card, { backgroundColor: colors.card }]}>
                <View style={s.cardHeader}>
                  <Text style={[s.cardTitle, { color: colors.heading }]}>Ponto {idx + 1}</Text>
                  {pontos.length > 1 && (
                    <TouchableOpacity onPress={() => setPontos(p => p.filter((_, i) => i !== idx))}>
                      <Text style={s.remover}>Remover</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* 1. Número */}
                <Text style={lbl}>Número do Ponto</Text>
                <TextInput style={inp} value={ponto.numero}
                  onChangeText={v => updatePonto(idx, 'numero', v)}
                  placeholder="Ex: 1" placeholderTextColor={colors.textMuted} keyboardType="numeric" />

                {/* 2. Pergunta aplicados + campos */}
                <Text style={[s.pergunta, { color: colors.text }]}>Possui equipamentos aplicados?</Text>
                <SimNao value={ponto.possuiAplicados} onChange={v => updatePonto(idx, 'possuiAplicados', v)} />

                {ponto.possuiAplicados === 'Sim' && (
                  <>
                    <Text style={[s.secao, { color: colors.heading, borderBottomColor: colors.border }]}>INSTALADO</Text>
                    <View style={s.row2}>
                      <View style={s.metade}>
                        <Text style={lbl}>Potência (KVA)</Text>
                        <TextInput style={inp} value={ponto.instalado.potencia}
                          onChangeText={v => updateSub(idx, 'instalado', 'potencia', v)}
                          placeholder="KVA" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                      </View>
                      <View style={s.metade}>
                        <Text style={lbl}>Patrimônio</Text>
                        <TextInput style={inp} value={ponto.instalado.patrimonio}
                          onChangeText={v => updateSub(idx, 'instalado', 'patrimonio', v)}
                          placeholder="Patrimônio" placeholderTextColor={colors.textMuted} />
                      </View>
                    </View>
                    <Text style={lbl}>Fase Instalação</Text>
                    <TextInput style={inp} value={ponto.instalado.faseInstalacao}
                      onChangeText={v => updateSub(idx, 'instalado', 'faseInstalacao', v)}
                      placeholder="Ex: Monofásico, Bifásico, Trifásico" placeholderTextColor={colors.textMuted} />
                    <View style={s.row2}>
                      <View style={s.metade}>
                        <Text style={lbl}>Série</Text>
                        <TextInput style={inp} value={ponto.instalado.serie}
                          onChangeText={v => updateSub(idx, 'instalado', 'serie', v)}
                          placeholder="Série" placeholderTextColor={colors.textMuted} />
                      </View>
                      <View style={s.metade}>
                        <Text style={lbl}>Marca</Text>
                        <TextInput style={inp} value={ponto.instalado.marca}
                          onChangeText={v => updateSub(idx, 'instalado', 'marca', v)}
                          placeholder="Marca" placeholderTextColor={colors.textMuted} />
                      </View>
                    </View>
                    <View style={s.row2}>
                      <View style={s.metade}>
                        <Text style={lbl}>Ano Fabricação</Text>
                        <TextInput style={inp} value={ponto.instalado.anoFabricacao}
                          onChangeText={v => updateSub(idx, 'instalado', 'anoFabricacao', v)}
                          placeholder="Ano" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                      </View>
                      <View style={s.metade}>
                        <Text style={lbl}>Nº da Instalação</Text>
                        <TextInput style={inp} value={ponto.instalado.nInstalacao}
                          onChangeText={v => updateSub(idx, 'instalado', 'nInstalacao', v)}
                          placeholder="Nº" placeholderTextColor={colors.textMuted} />
                      </View>
                    </View>

                    <Text style={[s.secao, { color: colors.heading, borderBottomColor: colors.border }]}>TENSÃO (V)</Text>
                    <View style={s.tensaoRow}>
                      {FASES_TENSAO.map(fase => (
                        <View key={fase} style={s.tensaoItem}>
                          <Text style={[s.tensaoLabel, { color: colors.text }]}>{fase}</Text>
                          <TextInput
                            style={[s.tensaoInput, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                            value={ponto.tensoes[fase]} onChangeText={v => updateSub(idx, 'tensoes', fase, v)}
                            placeholder="0.0" placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad" textAlign="center" />
                        </View>
                      ))}
                    </View>

                    <Text style={[s.secao, { color: colors.heading, borderBottomColor: colors.border }]}>FOTOS — INSTALADO</Text>
                    <View style={s.fotosRow}>
                      {ponto.fotosInstalado.map((uri, fotoIdx) => (
                        <View key={fotoIdx} style={s.fotoSlot}>
                          {uri ? (
                            <>
                              <Image source={{ uri }} style={s.fotoImg} />
                              <TouchableOpacity style={s.fotoRemove} onPress={() => removerFoto(idx, 'fotosInstalado', fotoIdx)}>
                                <Text style={s.fotoRemoveText}>✕</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity
                              style={[s.fotoAdd, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                              onPress={() => anexarFoto(idx, 'fotosInstalado', fotoIdx)}>
                              <Text style={s.fotoAddIcon}>📷</Text>
                              <Text style={[s.fotoAddText, { color: colors.textMuted }]}>Foto {fotoIdx + 1}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}

                <View style={[s.divisor, { backgroundColor: colors.border }]} />

                {/* 3. Pergunta removidos + campos */}
                <Text style={[s.pergunta, { color: colors.text }]}>Possui equipamentos removidos?</Text>
                <SimNao value={ponto.possuiRemovidos} onChange={v => updatePonto(idx, 'possuiRemovidos', v)} />

                {ponto.possuiRemovidos === 'Sim' && (
                  <>
                    <Text style={[s.secao, { color: colors.heading, borderBottomColor: colors.border }]}>RETIRADO</Text>
                    <View style={s.row2}>
                      <View style={s.metade}>
                        <Text style={lbl}>Potência (KVA)</Text>
                        <TextInput style={inp} value={ponto.retirado.potencia}
                          onChangeText={v => updateSub(idx, 'retirado', 'potencia', v)}
                          placeholder="KVA" placeholderTextColor={colors.textMuted} keyboardType="decimal-pad" />
                      </View>
                      <View style={s.metade}>
                        <Text style={lbl}>Patrimônio</Text>
                        <TextInput style={inp} value={ponto.retirado.patrimonio}
                          onChangeText={v => updateSub(idx, 'retirado', 'patrimonio', v)}
                          placeholder="Patrimônio" placeholderTextColor={colors.textMuted} />
                      </View>
                    </View>
                    <View style={s.row2}>
                      <View style={s.metade}>
                        <Text style={lbl}>Série</Text>
                        <TextInput style={inp} value={ponto.retirado.serie}
                          onChangeText={v => updateSub(idx, 'retirado', 'serie', v)}
                          placeholder="Série" placeholderTextColor={colors.textMuted} />
                      </View>
                      <View style={s.metade}>
                        <Text style={lbl}>Marca</Text>
                        <TextInput style={inp} value={ponto.retirado.marca}
                          onChangeText={v => updateSub(idx, 'retirado', 'marca', v)}
                          placeholder="Marca" placeholderTextColor={colors.textMuted} />
                      </View>
                    </View>
                    <View style={s.row2}>
                      <View style={s.metade}>
                        <Text style={lbl}>Ano Fabricação</Text>
                        <TextInput style={inp} value={ponto.retirado.anoFabricacao}
                          onChangeText={v => updateSub(idx, 'retirado', 'anoFabricacao', v)}
                          placeholder="Ano" placeholderTextColor={colors.textMuted} keyboardType="numeric" />
                      </View>
                      <View style={s.metade}>
                        <Text style={lbl}>Nº da Instalação</Text>
                        <TextInput style={inp} value={ponto.retirado.nInstalacao}
                          onChangeText={v => updateSub(idx, 'retirado', 'nInstalacao', v)}
                          placeholder="Nº" placeholderTextColor={colors.textMuted} />
                      </View>
                    </View>

                    <Text style={[s.secao, { color: colors.heading, borderBottomColor: colors.border }]}>FOTOS — RETIRADO</Text>
                    <View style={s.fotosRow}>
                      {ponto.fotosRetirado.map((uri, fotoIdx) => (
                        <View key={fotoIdx} style={s.fotoSlot}>
                          {uri ? (
                            <>
                              <Image source={{ uri }} style={s.fotoImg} />
                              <TouchableOpacity style={s.fotoRemove} onPress={() => removerFoto(idx, 'fotosRetirado', fotoIdx)}>
                                <Text style={s.fotoRemoveText}>✕</Text>
                              </TouchableOpacity>
                            </>
                          ) : (
                            <TouchableOpacity
                              style={[s.fotoAdd, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                              onPress={() => anexarFoto(idx, 'fotosRetirado', fotoIdx)}>
                              <Text style={s.fotoAddIcon}>📷</Text>
                              <Text style={[s.fotoAddText, { color: colors.textMuted }]}>Foto {fotoIdx + 1}</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      ))}
                    </View>
                  </>
                )}
              </View>
            );
          })}

          <TouchableOpacity style={[s.addBtn, { borderColor: colors.heading }]} onPress={() => setPontos(p => [...p, novoPonto()])}>
            <Text style={[s.addBtnText, { color: colors.heading }]}>+ Adicionar Ponto</Text>
          </TouchableOpacity>

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
  secao: {
    fontSize: 11, fontWeight: '800',
    marginTop: 14, marginBottom: 6, letterSpacing: 0.5,
    borderBottomWidth: 1, paddingBottom: 4,
  },
  label: { fontSize: 11, fontWeight: '700', marginTop: 8, marginBottom: 4, textTransform: 'uppercase' },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 13 },
  tensaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  tensaoItem: { width: '30%', alignItems: 'center' },
  tensaoLabel: { fontSize: 11, fontWeight: '700', marginBottom: 3 },
  tensaoInput: { borderWidth: 1, borderRadius: 6, paddingVertical: 6, fontSize: 13, width: '100%' },
  row2: { flexDirection: 'row', gap: 8 },
  metade: { flex: 1 },
  divisor: { height: 1, marginVertical: 14 },
  fotosRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  fotoSlot: { flex: 1, aspectRatio: 1, borderRadius: 8, overflow: 'hidden' },
  fotoImg: { width: '100%', height: '100%' },
  fotoRemove: {
    position: 'absolute', top: 4, right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10,
    width: 22, height: 22, justifyContent: 'center', alignItems: 'center',
  },
  fotoRemoveText: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  fotoAdd: {
    flex: 1, borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 8,
    justifyContent: 'center', alignItems: 'center', paddingVertical: 14,
  },
  fotoAddIcon: { fontSize: 20 },
  fotoAddText: { fontSize: 10, fontWeight: '600' },
  addBtn: { borderWidth: 1.5, borderStyle: 'dashed', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  simNaoRow: { flexDirection: 'row', gap: 16, marginBottom: 4 },
  checkOpcao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkBox: {
    width: 20, height: 20, borderRadius: 4, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center',
  },
  checkBoxAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  checkMark: { color: '#FFF', fontSize: 11, fontWeight: '800' },
  checkLabel: { fontSize: 13, fontWeight: '500' },
  concluirBtn: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  concluirText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
