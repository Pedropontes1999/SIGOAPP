// Supervisores de campo por empresa (parceira).
// Fonte: supervisores.xlsx — "SUPERVISOR DE CAMPO".
const SUPERVISORES_POR_EMPRESA = {
  COSAMPA: [
    'ALESSANDRO OLIVEIRA DA SILVA',
    'DAVI LOPES RODRIGUES',
    'LUIZ CARLOS DE SANTANA',
    'PAULO EDUARDO DO SANTOS',
  ],
  ENGELMIG: [
    'ALDAIR PEREIRA DA COSTA',
    'FELIPE VERISSIMO SOUZA DOS SANTOS',
    'GLEISON COSTA DA SILVA',
    'JOAO PAULO LISBOA',
    'LUAN OLIVEIRA DOS SANTOS',
    'LUAN YUDI TAIRA',
    'LUIS FREDERIC DO COUTO COSTA',
    'MAURICIO MARQUES CASSIANO DE MATTOS',
    'RANIERI PATRICK PEREIRA DA COSTA',
  ],
  LIG: [
    'CARLOS HENRIQUE DE MORAES SIQUEIRA',
    'THIAGO JOSE DIAS DOS SANTOS',
  ],
  MANSERV: [
    'ANDERSON BARBOSA LOPES',
    'EDIMAR MARTINS DA SILVA',
    'FABRICIO RODRIGUES DOS REIS',
    'FRANCISCO DE ASSIS DOS SANTOS',
    'FRANCISCO PAIVA FREITAS',
    'GEOVANA FARIA MILIAN',
    'HANDEL JUNIOR DE OLIVEIRA GOMES',
    'JEFFERSON RIBEIRO COSTA',
    'MARCO ANTONIO DA SILVA',
    'THIAGO DE CASTRO MELLO',
    'VLADENILSON CIRQUEIRA COSTA',
  ],
  START: [
    'Agnaldo Fernando de Carvalho',
    'Benedito Sérgio da Cruz',
    'Elizeu Alfredo Martins',
    'Elvis da Silva Monteiro',
    'IAGO GIOVANE SILVA PRADO',
    'Jose Araujo da Silva',
    'Manoel Pereira da Costa',
    'Paulo da Silva Pessoa',
    'PAULO IVAN DO PRADO',
    'Roberto Alves Ianez',
    'Sidnei de Paula',
    'Valnei Roberto Alves da Silva',
    'Walter Ferraz de Carvalho Junior',
    'Wellington Luiz Pereira',
  ],
};

// Lista achatada com todos os supervisores (fallback).
const TODOS_SUPERVISORES = Object.entries(SUPERVISORES_POR_EMPRESA)
  .flatMap(([empresa, nomes]) => nomes.map(nome => ({ nome, empresa })));

// Normaliza a parceira da equipe para a chave da empresa.
// Ex.: 'Start Mogi' / 'Start Vale' -> 'START'.
function normalizarEmpresa(parceira) {
  const p = String(parceira || '').trim().toUpperCase();
  if (p.startsWith('START')) return 'START';
  return p;
}

// Supervisores da empresa da equipe. Se não houver correspondência
// (ex.: COMPEL), retorna todos como fallback.
export function getSupervisoresByParceira(parceira) {
  const empresa = normalizarEmpresa(parceira);
  const lista = SUPERVISORES_POR_EMPRESA[empresa];
  if (lista && lista.length) return lista.map(nome => ({ nome, empresa }));
  return TODOS_SUPERVISORES;
}

// Todos os supervisores agrupados por empresa, para o seletor da obra.
// [{ empresa, supervisores: [{ nome, empresa }] }, ...]
export function getSupervisoresAgrupados() {
  return Object.entries(SUPERVISORES_POR_EMPRESA).map(([empresa, nomes]) => ({
    empresa,
    supervisores: nomes.map(nome => ({ nome, empresa })),
  }));
}

// Supervisores agrupados, apenas das empresas presentes na obra.
// Recebe a lista de parceiras das equipes; se nenhuma casar, devolve todos.
export function getSupervisoresParaParceiras(parceiras = []) {
  const empresas = new Set(parceiras.map(normalizarEmpresa).filter(Boolean));
  const grupos = getSupervisoresAgrupados().filter(g => empresas.has(g.empresa));
  return grupos.length ? grupos : getSupervisoresAgrupados();
}

export { TODOS_SUPERVISORES };
