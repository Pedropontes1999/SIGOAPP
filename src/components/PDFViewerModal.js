import React, { useRef, useEffect, useState } from 'react';
import {
  Modal, View, Text, TouchableOpacity, StyleSheet,
  Platform, SafeAreaView,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '../context/ThemeContext';

// Cores disponíveis na barra de ferramentas de anotação
const CORES = ['#FFFF00', '#EF4444', '#3B82F6', '#16A34A', '#F97316', '#FFFFFF'];

// Modal para visualizar PDF e desenhar anotações sobre ele (apenas web via iframe + canvas)
export default function PDFViewerModal({ visible, uri, nome, annotations, onClose, onSaveAnnotations, onUpdate }) {
  const { colors } = useTheme();
  // containerRef envolve iframe + canvas sobrepostos; canvasRef é onde o usuário desenha
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const iframeRef = useRef(null);
  const isDrawing = useRef(false);
  const lastPos = useRef(null);
  const colorRef = useRef('#FFFF00');
  const eraserRef = useRef(false);
  const savedDataRef = useRef(annotations ?? null); // salva localmente sem re-render pai

  const [activeCor, setActiveCor] = useState('#FFFF00');
  const [isEraser, setIsEraser] = useState(false);

  // Troca cor ativa e desativa borracha
  function setCor(c) {
    colorRef.current = c;
    eraserRef.current = false;
    setActiveCor(c);
    setIsEraser(false);
  }
  // Alterna modo borracha (usa destination-out no canvas)
  function toggleEraser() {
    eraserRef.current = !eraserRef.current;
    setIsEraser(v => !v);
  }

  // Exporta canvas como PNG base64 e notifica o pai antes de fechar
  function salvarAnotacoes() {
    if (!canvasRef.current) return;
    savedDataRef.current = canvasRef.current.toDataURL('image/png');
    onSaveAnnotations(savedDataRef.current);
    onClose();
  }

  // Apaga todos os traços do canvas sem fechar o modal
  function limparCanvas() {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    savedDataRef.current = null;
  }

  function handleClose() {
    // Passa anotações pro pai só ao fechar (evita re-render enquanto modal está aberto)
    onSaveAnnotations(savedDataRef.current);
    onClose();
  }

  // Permite trocar o PDF sem perder o modal — limpa anotações e notifica TrajetoScreen
  async function carregarAtualizado() {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (!result.canceled && result.assets?.length > 0) {
      savedDataRef.current = null;
      onSaveAnnotations(null);
      onUpdate(result.assets[0]);
      onClose();
    }
  }

  useEffect(() => {
    // Sincroniza ref quando prop muda (ex: modal reabre após trocar PDF)
    savedDataRef.current = annotations ?? null;
  }, [annotations]);

  // Cria iframe (PDF) + canvas (desenho) sobrepostos no container; conecta eventos de mouse/touch
  useEffect(() => {
    if (Platform.OS !== 'web' || !visible || !uri) return;

    const timer = setTimeout(() => {
      const container = containerRef.current;
      if (!container) return;

      while (container.firstChild) container.removeChild(container.firstChild);

      const w = container.offsetWidth || window.innerWidth;
      const h = container.offsetHeight || (window.innerHeight - 130);

      const iframe = document.createElement('iframe');
      iframe.src = uri;
      iframe.style.cssText = `position:absolute;top:0;left:0;width:${w}px;height:${h}px;border:none;`;
      container.appendChild(iframe);
      iframeRef.current = iframe;

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      canvas.style.cssText = `position:absolute;top:0;left:0;cursor:crosshair;touch-action:none;`;
      container.appendChild(canvas);
      canvasRef.current = canvas;

      if (savedDataRef.current) {
        const ctx = canvas.getContext('2d');
        const img = new Image();
        img.onload = () => ctx.drawImage(img, 0, 0, w, h);
        img.src = savedDataRef.current;
      }

      const getPos = (e) => {
        const rect = canvas.getBoundingClientRect();
        const src = e.touches ? e.touches[0] : e;
        return { x: src.clientX - rect.left, y: src.clientY - rect.top };
      };
      const onStart = (e) => { e.preventDefault(); isDrawing.current = true; lastPos.current = getPos(e); };
      const onMove = (e) => {
        e.preventDefault();
        if (!isDrawing.current) return;
        const pos = getPos(e);
        const ctx = canvas.getContext('2d');
        ctx.beginPath();
        ctx.lineWidth = eraserRef.current ? 30 : 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.globalCompositeOperation = eraserRef.current ? 'destination-out' : 'source-over';
        ctx.strokeStyle = eraserRef.current ? 'rgba(0,0,0,1)' : colorRef.current;
        ctx.moveTo(lastPos.current.x, lastPos.current.y);
        ctx.lineTo(pos.x, pos.y);
        ctx.stroke();
        lastPos.current = pos;
      };
      const onEnd = () => { isDrawing.current = false; };

      canvas.addEventListener('mousedown', onStart);
      canvas.addEventListener('mousemove', onMove);
      canvas.addEventListener('mouseup', onEnd);
      canvas.addEventListener('mouseleave', onEnd);
      canvas.addEventListener('touchstart', onStart, { passive: false });
      canvas.addEventListener('touchmove', onMove, { passive: false });
      canvas.addEventListener('touchend', onEnd);
    }, 150);

    return () => {
      clearTimeout(timer);
      const container = containerRef.current;
      if (container) while (container.firstChild) container.removeChild(container.firstChild);
      canvasRef.current = null;
      iframeRef.current = null;
    };
  }, [visible, uri]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <SafeAreaView style={s.safe}>
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.title}>Projeto PDF</Text>
            {nome ? <Text style={s.subtitle} numberOfLines={1}>{nome}</Text> : null}
          </View>
          <TouchableOpacity style={s.saveBtn} onPress={salvarAnotacoes}>
            <Text style={s.saveBtnText}>💾 Salvar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.closeBtn} onPress={handleClose}>
            <Text style={s.closeText}>✕</Text>
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' && (
          <View style={s.toolbar}>
            {CORES.map(c => (
              <TouchableOpacity
                key={c}
                onPress={() => setCor(c)}
                style={[s.corBtn, { backgroundColor: c }, activeCor === c && !isEraser && s.corBtnAtivo]}
              />
            ))}
            <View style={s.sep} />
            <TouchableOpacity style={[s.ferrBtn, isEraser && s.ferrBtnAtivo]} onPress={toggleEraser}>
              <Text style={s.ferrBtnText}>⌫</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.ferrBtn, { borderColor: '#EF4444' }]} onPress={limparCanvas}>
              <Text style={[s.ferrBtnText, { color: '#EF4444' }]}>🗑</Text>
            </TouchableOpacity>
            <TouchableOpacity style={s.trocaBtn} onPress={carregarAtualizado}>
              <Text style={s.trocaBtnText}>↑ Trocar PDF</Text>
            </TouchableOpacity>
          </View>
        )}

        <View ref={containerRef} style={s.viewer}>
          {Platform.OS !== 'web' && (
            <View style={s.noSupport}>
              <Text style={{ color: colors.textMuted, textAlign: 'center' }}>Disponível apenas no navegador.</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0F172A' },
  header: {
    backgroundColor: '#1E3A5F', flexDirection: 'row',
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, gap: 8,
  },
  title: { color: '#FFF', fontSize: 14, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.6)', fontSize: 11, marginTop: 1 },
  saveBtn: { backgroundColor: '#16A34A', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  saveBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  closeBtn: {
    backgroundColor: 'rgba(255,255,255,0.2)', width: 32, height: 32,
    borderRadius: 16, justifyContent: 'center', alignItems: 'center',
  },
  closeText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  toolbar: {
    backgroundColor: '#1E293B', flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8, gap: 8,
  },
  corBtn: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  corBtnAtivo: { borderColor: '#FFF' },
  sep: { width: 1, height: 24, backgroundColor: '#475569' },
  ferrBtn: {
    width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: '#94A3B8',
    justifyContent: 'center', alignItems: 'center',
  },
  ferrBtnAtivo: { backgroundColor: '#334155', borderColor: '#FFF' },
  ferrBtnText: { fontSize: 16 },
  trocaBtn: { marginLeft: 'auto', backgroundColor: '#334155', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  trocaBtnText: { color: '#93C5FD', fontSize: 11, fontWeight: '700' },
  viewer: { flex: 1, position: 'relative' },
  noSupport: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
});
