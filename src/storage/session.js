import AsyncStorage from '@react-native-async-storage/async-storage';

const AUTH_KEY      = '@sigo:auth';
const TRAJETO_KEY   = '@sigo:trajeto';
const OBRAS_KEY     = '@sigo:obrasList';
const COMPLETED_KEY = '@sigo:completedObras';

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

// ── LISTA DE OBRAS DO DIA ─────────────────────────────────────────────────────

// Salva todas as obras filtradas pela sigla do usuário (para fluxo "Próxima Obra")
export async function saveObrasList(obras) {
  try {
    await AsyncStorage.setItem(OBRAS_KEY, JSON.stringify(obras));
  } catch {}
}

// Recupera a lista de obras salva
export async function loadObrasList() {
  try {
    const raw = await AsyncStorage.getItem(OBRAS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Limpa a lista de obras (chamado no logout)
export async function clearObrasList() {
  try {
    await AsyncStorage.removeItem(OBRAS_KEY);
  } catch {}
}

// ── OBRAS CONCLUÍDAS ──────────────────────────────────────────────────────────

// Adiciona o OVNOTA de uma obra concluída à lista persistida
export async function saveCompletedObra(ovnota) {
  try {
    const existing = await loadCompletedObras();
    const updated = [...new Set([...existing, String(ovnota)])];
    await AsyncStorage.setItem(COMPLETED_KEY, JSON.stringify(updated));
  } catch {}
}

// Retorna array de OVNOTAs (strings) das obras já concluídas
export async function loadCompletedObras() {
  try {
    const raw = await AsyncStorage.getItem(COMPLETED_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Limpa obras concluídas (chamado no logout e ao enviar novo Excel)
export async function clearCompletedObras() {
  try {
    await AsyncStorage.removeItem(COMPLETED_KEY);
  } catch {}
}
