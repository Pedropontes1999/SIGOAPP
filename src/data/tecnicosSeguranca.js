// Técnicos de segurança por empresa (parceira).
// ATENÇÃO: nomes ALEATÓRIOS/provisórios — substituir pela tabela real quando recebida.
const TECNICOS_POR_EMPRESA = {
  COSAMPA: [
    'RAFAEL MENDES DE ALMEIDA',
    'TATIANE ROCHA FERREIRA',
    'BRUNO SANTANA DE LIMA',
  ],
  ENGELMIG: [
    'CAMILA SOARES PACHECO',
    'DIEGO FONSECA RIBEIRO',
    'FERNANDA CALDAS MOREIRA',
    'GUSTAVO HENRIQUE NOGUEIRA',
    'PATRICIA LEMOS DE ANDRADE',
  ],
  LIG: [
    'MARCELO TAVARES BRITO',
    'VIVIANE CARDOSO DUARTE',
  ],
  MANSERV: [
    'ANDERSON PRADO MACHADO',
    'ELAINE CRISTINA BARROS',
    'FABIO REZENDE GUIMARAES',
    'JULIANA PIRES DE SOUZA',
    'RICARDO VIANA TEIXEIRA',
  ],
  START: [
    'ALEXANDRE BORGES PINHEIRO',
    'CAROLINA MEDEIROS LACERDA',
    'EDUARDO NAVARRO CAMPOS',
    'LARISSA QUEIROZ FONTES',
    'THIAGO MELLO BARBOSA',
    'WAGNER LUCENA DE FARIA',
  ],
};

// Lista achatada com todos os técnicos (fallback).
const TODOS_TECNICOS = Object.entries(TECNICOS_POR_EMPRESA)
  .flatMap(([empresa, nomes]) => nomes.map(nome => ({ nome, empresa })));

// Normaliza a parceira da equipe para a chave da empresa.
// Ex.: 'Start Mogi' / 'Start Vale' -> 'START'.
function normalizarEmpresa(parceira) {
  const p = String(parceira || '').trim().toUpperCase();
  if (p.startsWith('START')) return 'START';
  return p;
}

// Técnicos de segurança da empresa da equipe. Se não houver correspondência,
// retorna todos como fallback.
export function getTecnicosByParceira(parceira) {
  const empresa = normalizarEmpresa(parceira);
  const lista = TECNICOS_POR_EMPRESA[empresa];
  if (lista && lista.length) return lista.map(nome => ({ nome, empresa }));
  return TODOS_TECNICOS;
}

// Todos os técnicos agrupados por empresa.
// [{ empresa, tecnicos: [{ nome, empresa }] }, ...]
export function getTecnicosAgrupados() {
  return Object.entries(TECNICOS_POR_EMPRESA).map(([empresa, nomes]) => ({
    empresa,
    tecnicos: nomes.map(nome => ({ nome, empresa })),
  }));
}

// Técnicos agrupados, apenas das empresas presentes na obra.
// Recebe a lista de parceiras das equipes; se nenhuma casar, devolve todos.
export function getTecnicosParaParceiras(parceiras = []) {
  const empresas = new Set(parceiras.map(normalizarEmpresa).filter(Boolean));
  const grupos = getTecnicosAgrupados().filter(g => empresas.has(g.empresa));
  return grupos.length ? grupos : getTecnicosAgrupados();
}

export { TODOS_TECNICOS };
