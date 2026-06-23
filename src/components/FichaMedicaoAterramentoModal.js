import React, { useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  ScrollView, TextInput, Image, Alert, Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { useTheme } from '../context/ThemeContext';
import { useSidebar } from '../context/SidebarContext';

// Limita a medição a no máximo 2 dígitos inteiros e 1 casa decimal (ex: 20.5)
function formatMedicao(v) {
  const s = v.replace(/[^0-9.,]/g, '').replace(',', '.');
  const [intPart = '', ...rest] = s.split('.');
  const inteiro = intPart.slice(0, 2);
  if (rest.length === 0) return inteiro;          // ainda sem separador
  return inteiro + '.' + rest.join('').slice(0, 1); // 1 casa decimal
}

const novoPonto = (numeroPonto = '') => ({
  coordenada: '',
  rua: '',
  numeroPonto: String(numeroPonto),
  tipoPoste: 'CONC',
  medicaoFinal: '',
  qtHastes: '',
  fotos: [null, null],
});

export default function FichaMedicaoAterramentoModal({ visible, onClose, onConcluir, pontosProgramados = [] }) {
  const { colors } = useTheme();
  const { open: openSidebar } = useSidebar();
  const [pontos, setPontos] = useState([]);
  const [colaboradorEDP, setColaboradorEDP] = useState('');
  const [colaboradorParceira, setColaboradorParceira] = useState('');
  const [loadingGeo, setLoadingGeo] = useState(null);
  const [showPicker, setShowPicker] = useState(false);

  // Pontos programados ainda não adicionados
  const numerosJaAdicionados = pontos.map(p => p.numeroPonto);
  const pontosDisponiveis = pontosProgramados.filter(p => !numerosJaAdicionados.includes(String(p)));

  async function obterLocalizacao(idx) {
    setLoadingGeo(idx);
    try {
      let latitude, longitude;
      if (Platform.OS === 'web') {
        if (!navigator?.geolocation) {
          Alert.alert('Não suportado', 'Seu navegador não suporta geolocalização.');
          return;
        }
        const pos = await new Promise((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: false, timeout: 15000, maximumAge: 0,
          })
        );
        latitude = pos.coords.latitude;
        longitude = pos.coords.longitude;
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert('Permissão negada', 'Autorize o acesso à localização nas configurações.');
          return;
        }
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        latitude = loc.coords.latitude;
        longitude = loc.coords.longitude;
      }
      const coordStr = `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
      let rua = '';
      try {
        if (Platform.OS === 'web') {
          const resp = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            { headers: { 'Accept-Language': 'pt-BR' } }
          );
          const data = await resp.json();
          const a = data?.address ?? {};
          rua = [a.road, a.suburb, a.city || a.town || a.village].filter(Boolean).join(', ');
        } else {
          const [endereco] = await Location.reverseGeocodeAsync({ latitude, longitude });
          rua = [endereco?.street, endereco?.district, endereco?.city].filter(Boolean).join(', ');
        }
      } catch { /* coordenadas obtidas, rua fica vazia */ }
      // Trava a rua somente quando o GPS conseguiu preenchê-la
      setPontos(prev => prev.map((p, i) => i === idx ? { ...p, coordenada: coordStr, rua, ruaTravada: !!rua } : p));
    } catch (e) {
      Alert.alert('Erro ao obter localização', e?.message || 'Verifique as permissões do navegador/GPS.');
    } finally {
      setLoadingGeo(null);
    }
  }

  function updatePonto(idx, field, value) {
    setPontos(prev => prev.map((p, i) => i === idx ? { ...p, [field]: value } : p));
  }

  async function anexarFoto(pontoIdx, fotoIdx) {
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
      setPontos(prev => prev.map((p, i) => {
        if (i !== pontoIdx) return p;
        const f = [...p.fotos];
        f[fotoIdx] = result.assets[0].uri;
        return { ...p, fotos: f };
      }));
    }
  }

  function removerFoto(pontoIdx, fotoIdx) {
    setPontos(prev => prev.map((p, i) => {
      if (i !== pontoIdx) return p;
      const f = [...p.fotos];
      f[fotoIdx] = null;
      return { ...p, fotos: f };
    }));
  }

  function adicionarPonto(numeroPonto) {
    setPontos(prev => [...prev, novoPonto(numeroPonto)]);
    setShowPicker(false);
  }

  function handleConcluir() {
    onConcluir({ pontos, colaboradorEDP, colaboradorParceira });
    onClose();
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[s.safe, { backgroundColor: colors.bg }]}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Ficha Medição Aterramento</Text>
          <View style={s.headerRight}>
            <TouchableOpacity onPress={openSidebar} style={s.menuBtn}>
              <Text style={s.menuBtnText}>☰</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Text style={s.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={[s.body, { backgroundColor: colors.bg }]}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={[s.formTitle, { color: colors.heading }]}>FICHA DE MEDIÇÃO DE ATERRAMENTO</Text>

          {pontos.map((ponto, idx) => (
            <View key={idx} style={[s.card, { backgroundColor: colors.card }]}>
              <View style={s.cardHeader}>
                <Text style={[s.cardTitle, { color: colors.heading }]}>
                  {ponto.numeroPonto ? `Ponto ${ponto.numeroPonto}` : `Ponto ${idx + 1}`}
                </Text>
                <TouchableOpacity onPress={() => setPontos(p => p.filter((_, i) => i !== idx))}>
                  <Text style={s.remover}>Remover</Text>
                </TouchableOpacity>
              </View>

              <View style={s.labelRow}>
                <Text style={[s.label, { color: colors.fieldLabel }]}>Coordenada</Text>
                <TouchableOpacity
                  style={[s.geoBtn, { backgroundColor: colors.equipeRowActiveBg, borderColor: colors.border }]}
                  onPress={() => obterLocalizacao(idx)}
                  disabled={loadingGeo === idx}
                >
                  {loadingGeo === idx
                    ? <ActivityIndicator size={14} color={colors.heading} />
                    : <Text style={[s.geoBtnText, { color: colors.heading }]}>📍 Usar GPS</Text>
                  }
                </TouchableOpacity>
              </View>
              {/* Coordenada é sempre bloqueada — preenchida apenas pelo botão "Usar GPS" */}
              <TextInput
                style={[s.input, s.inputDisabled, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.textMuted }]}
                value={ponto.coordenada}
                editable={false}
                placeholder="Toque em 'Usar GPS' para preencher"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[s.label, { color: colors.fieldLabel }]}>Rua / Avenida / Estrada</Text>
              {/* Trava após ser preenchida pelo GPS; editável enquanto o GPS não preenche */}
              <TextInput
                style={[s.input, ponto.ruaTravada && s.inputDisabled,
                  { backgroundColor: colors.inputBg, borderColor: colors.border, color: ponto.ruaTravada ? colors.textMuted : colors.inputText }]}
                value={ponto.rua}
                onChangeText={v => updatePonto(idx, 'rua', v)}
                editable={!ponto.ruaTravada}
                placeholder="Nome da rua"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[s.label, { color: colors.fieldLabel }]}>Número do Ponto (Projeto)</Text>
              <TextInput
                style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                value={ponto.numeroPonto}
                onChangeText={v => updatePonto(idx, 'numeroPonto', v)}
                placeholder="Ex: 1"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
              />

              <Text style={[s.label, { color: colors.fieldLabel }]}>Tipo do Poste</Text>
              <View style={s.toggleRow}>
                {['CONC', 'MAD'].map(tipo => (
                  <TouchableOpacity
                    key={tipo}
                    style={[s.toggleBtn,
                      { backgroundColor: colors.inputBg, borderColor: colors.border },
                      ponto.tipoPoste === tipo && s.toggleAtivo]}
                    onPress={() => updatePonto(idx, 'tipoPoste', tipo)}
                  >
                    <Text style={[s.toggleText, { color: colors.textMuted }, ponto.tipoPoste === tipo && s.toggleTextAtivo]}>
                      {tipo}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={s.row2}>
                <View style={s.metade}>
                  <Text style={[s.label, { color: colors.fieldLabel }]}>Medição Final (Ohms)</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                    value={ponto.medicaoFinal}
                    onChangeText={v => updatePonto(idx, 'medicaoFinal', formatMedicao(v))}
                    placeholder="Ex: 20.5"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="decimal-pad"
                  />
                </View>
                <View style={s.metade}>
                  <Text style={[s.label, { color: colors.fieldLabel }]}>Qt. Hastes</Text>
                  <TextInput
                    style={[s.input, { backgroundColor: colors.inputBg, borderColor: colors.border, color: colors.inputText }]}
                    value={ponto.qtHastes}
                    onChangeText={v => updatePonto(idx, 'qtHastes', v.replace(/[^0-9]/g, '').slice(0, 2))}
                    placeholder="Ex: 3"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[s.label, { color: colors.fieldLabel }]}>Fotos do Local</Text>
              <View style={s.fotosRow}>
                {ponto.fotos.map((uri, fotoIdx) => (
                  <View key={fotoIdx} style={s.fotoSlot}>
                    {uri ? (
                      <>
                        <Image source={{ uri }} style={s.fotoImg} />
                        <TouchableOpacity style={s.fotoRemove} onPress={() => removerFoto(idx, fotoIdx)}>
                          <Text style={s.fotoRemoveText}>✕</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <TouchableOpacity
                        style={[s.fotoAdd, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                        onPress={() => anexarFoto(idx, fotoIdx)}
                      >
                        <Text style={s.fotoAddIcon}>📷</Text>
                        <Text style={[s.fotoAddText, { color: colors.textMuted }]}>Foto {fotoIdx + 1}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                ))}
              </View>
            </View>
          ))}

          {/* Picker de ponto programado */}
          {showPicker && (
            <View style={[s.pickerCard, { backgroundColor: colors.card }]}>
              <Text style={[s.pickerTitle, { color: colors.heading }]}>Ponto Programado</Text>
              {pontosDisponiveis.length > 0 && pontosDisponiveis.map(p => (
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
            <TouchableOpacity
              style={[s.addBtn, { borderColor: colors.heading }]}
              onPress={() => setShowPicker(true)}
            >
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
  formTitle: {
    fontSize: 13, fontWeight: '800',
    textAlign: 'center', marginBottom: 16, letterSpacing: 0.5,
  },
  card: {
    borderRadius: 12, padding: 14, marginBottom: 12, elevation: 2,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05, shadowRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  cardTitle: { fontSize: 14, fontWeight: '800' },
  remover: { fontSize: 12, color: '#EF4444', fontWeight: '600' },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', marginTop: 10, marginBottom: 4 },
  geoBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, gap: 4 },
  geoBtnText: { fontSize: 11, fontWeight: '700' },
  input: {
    borderWidth: 1, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8, fontSize: 13,
  },
  inputDisabled: { opacity: 0.7 },
  toggleRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1.5, alignItems: 'center' },
  toggleAtivo: { backgroundColor: '#1E3A5F', borderColor: '#1E3A5F' },
  toggleText: { fontSize: 13, fontWeight: '700' },
  toggleTextAtivo: { color: '#FFF' },
  row2: { flexDirection: 'row', gap: 8 },
  metade: { flex: 1 },
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
  pickerCard: {
    borderRadius: 12, padding: 14, marginBottom: 12, elevation: 3,
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
  addBtn: {
    borderWidth: 1.5, borderStyle: 'dashed',
    borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12,
  },
  addBtnText: { fontSize: 13, fontWeight: '700' },
  concluirBtn: {
    backgroundColor: '#16A34A', borderRadius: 12,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  concluirText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
});
