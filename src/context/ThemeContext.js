import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const THEME_KEY = '@sigo:theme';

// Paleta completa de cores para tema claro e escuro
// Cada chave é consumida pelas telas via useTheme().colors
export const COLORS = {
  light: {
    // backgrounds
    bg: '#F3F4F6',
    card: '#FFFFFF',
    inputBg: '#F9FAFB',
    memberDisplay: '#F3F4F6',
    chipBg: '#F9FAFB',
    equipeRowActiveBg: '#EFF6FF',
    pausaBg: '#FEF3C7',
    asBuildBg: '#F9FAFB',
    checkRowDone: '#F0FDF4',
    opcoesCard: '#FFFFFF',
    concluidoBox: '#FFFFFF',
    execToggleBg: '#FFFFFF',
    asBuildThumbVazio: '#E5E7EB',
    footerBg: '#FFFFFF',
    // borders
    border: '#E5E7EB',
    chipBorder: '#D1D5DB',
    checkRowBorder: '#E5E7EB',
    checkRowDoneBorder: '#86EFAC',
    pausaBorder: '#FCD34D',
    asBuildBorder: '#E5E7EB',
    execToggleBorder: '#D1D5DB',
    footerBorder: '#E5E7EB',
    infoRowBorder: '#F3F4F6',
    radioBorder: '#D1D5DB',
    equipeRowBorder: '#F3F4F6',
    // text
    text: '#111827',
    textSub: '#6B7280',
    textMuted: '#9CA3AF',
    inputText: '#111827',
    heading: '#1E3A5F',
    sectionTitle: '#374151',
    sectionLabel: '#374151',
    fieldLabel: '#374151',
    memberSelf: '#1D4ED8',
    linkText: '#3B82F6',
    chipText: '#374151',
    equipeNome: '#111827',
    equipeNomeActive: '#1E3A5F',
    equipeSub: '#9CA3AF',
    infoLabel: '#9CA3AF',
    infoValue: '#111827',
    radioLabel: '#374151',
    resumeLabel: '#6B7280',
    resumeValue: '#111827',
    // accents
    timer: '#1E3A5F',
    timerLabel: '#6B7280',
    cardDoneLeft: '#16A34A',
    tagDoneBg: '#DCFCE7',
    tagDoneText: '#16A34A',
    checkRow: '#F9FAFB',
  },
  dark: {
    // backgrounds — gestaoDeObrasCCM palette: #212E3E base, #1A2636 deeper
    bg: '#1A2636',
    card: '#212E3E',
    inputBg: '#192535',
    memberDisplay: '#1A2636',
    chipBg: '#2F3C4F',
    equipeRowActiveBg: '#1E3A5F',
    pausaBg: '#212E3E',
    asBuildBg: '#212E3E',
    checkRowDone: 'rgba(83,255,117,0.07)',
    opcoesCard: '#212E3E',
    concluidoBox: '#212E3E',
    execToggleBg: '#212E3E',
    asBuildThumbVazio: '#2F3C4F',
    footerBg: '#212E3E',
    // borders — translucent white, matches gestao's border-white/[0.06]
    border: 'rgba(255,255,255,0.09)',
    chipBorder: 'rgba(255,255,255,0.13)',
    checkRowBorder: 'rgba(255,255,255,0.09)',
    checkRowDoneBorder: 'rgba(83,255,117,0.35)',
    pausaBorder: 'rgba(255,255,255,0.1)',
    asBuildBorder: 'rgba(255,255,255,0.09)',
    execToggleBorder: 'rgba(255,255,255,0.13)',
    footerBorder: 'rgba(255,255,255,0.09)',
    infoRowBorder: 'rgba(255,255,255,0.06)',
    radioBorder: 'rgba(255,255,255,0.13)',
    equipeRowBorder: 'rgba(255,255,255,0.06)',
    // text
    text: '#E4E4E7',
    textSub: '#94A3B8',
    textMuted: '#64748B',
    inputText: '#E4E4E7',
    heading: '#F1F5F9',
    sectionTitle: '#94A3B8',
    sectionLabel: '#CBD5E1',
    fieldLabel: '#94A3B8',
    memberSelf: '#60A5FA',
    linkText: '#60A5FA',
    chipText: '#CBD5E1',
    equipeNome: '#E4E4E7',
    equipeNomeActive: '#F1F5F9',
    equipeSub: '#64748B',
    infoLabel: '#64748B',
    infoValue: '#E4E4E7',
    radioLabel: '#CBD5E1',
    resumeLabel: '#94A3B8',
    resumeValue: '#E4E4E7',
    // accents — #53FF75 neon green is gestao's brand accent
    timer: '#53FF75',
    timerLabel: '#94A3B8',
    cardDoneLeft: '#53FF75',
    tagDoneBg: 'rgba(83,255,117,0.12)',
    tagDoneText: '#53FF75',
    checkRow: '#212E3E',
  },
};

const ThemeContext = createContext({ isDark: false, colors: COLORS.light, toggle: () => {} });

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  // Carrega preferência de tema salva no AsyncStorage
  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY).then(v => {
      if (v === 'dark') setIsDark(true);
    });
  }, []);

  // Alterna tema e persiste a escolha
  function toggle() {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light');
  }

  return (
    <ThemeContext.Provider value={{ isDark, colors: isDark ? COLORS.dark : COLORS.light, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
