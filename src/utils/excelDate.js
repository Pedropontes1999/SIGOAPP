// Converte serial de data do Excel (dias desde 1/1/1900) para DD/MM/AAAA
export function excelDateToStr(serial) {
  if (typeof serial !== 'number' || !serial) return '—';
  const d = new Date((serial - 25569) * 86400 * 1000);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

// Converte serial de hora do Excel (fração do dia) para HH:MM
export function excelTimeToStr(serial) {
  if (typeof serial !== 'number' || !serial) return '—';
  const totalMin = Math.round((serial % 1) * 24 * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}
