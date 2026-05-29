import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY    = '@sigo:auth';
const TRAJETO_KEY = '@sigo:trajeto';

// ── AUTENTICAÇÃO ─────────────────────────────────────────────────────────────

// Salva dados do usuário logado para sobreviver ao fechamento do app
export async function saveAuth(user) {
  try {
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(user));
  } catch {}
}

// Recupera sessão de auth salva; retorna null se não houver nenhuma
export async function loadAuth() {
  try {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Remove sessão de auth (chamado no logout)
export async function clearAuth() {
  try {
    await AsyncStorage.removeItem(AUTH_KEY);
  } catch {}
}

// ── SESSÃO DO TRAJETO ─────────────────────────────────────────────────────────

// Salva estado completo do trajeto (etapa, timers, pausas, checklists, fotos...)
export async function saveTrajetoSession(data) {
  try {
    await AsyncStorage.setItem(TRAJETO_KEY, JSON.stringify(data));
  } catch {}
}

// Recupera estado do trajeto para retomar de onde parou
export async function loadTrajetoSession() {
  try {
    const raw = await AsyncStorage.getItem(TRAJETO_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Limpa sessão do trajeto ao encerrar o dia ou gerar relatório
export async function clearTrajetoSession() {
  try {
    await AsyncStorage.removeItem(TRAJETO_KEY);
  } catch {}
}
