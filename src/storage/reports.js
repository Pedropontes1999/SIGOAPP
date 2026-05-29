import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_REPORTS = 20; // limite de relatórios mantidos por sigla

// Chave de armazenamento isolada por sigla do usuário
function reportsKey(sigla) {
  return `@sigo:reports:${sigla ?? 'unknown'}`;
}

// Salva relatório no início da lista; descarta os mais antigos após MAX_REPORTS
export async function saveReport(data) {
  try {
    const sigla = data.user?.sigla;
    const existing = await loadReports(sigla);
    const updated = [{ ...data, savedAt: Date.now() }, ...existing].slice(0, MAX_REPORTS);
    await AsyncStorage.setItem(reportsKey(sigla), JSON.stringify(updated));
  } catch {}
}

// Recupera histórico de relatórios da sigla; retorna array vazio se não houver
export async function loadReports(sigla) {
  try {
    const raw = await AsyncStorage.getItem(reportsKey(sigla));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
