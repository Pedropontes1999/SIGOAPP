import { MOCK_USERS } from './mockUsers';

// Real team members keyed by sigla; first member (leader) is the logged-in user and is excluded.
const TEAM_MEMBERS = {
  ENGLM01: ['SILVIO SANTOS DE MELO - Motorista','NIKOLAS OLIVEIRA ARAUJO - Eletricista','KELVIN BATISTA DE OLIVEIRA DIAS - Eletricista','IGOR VAGULA ALVES DA CUNHA - Eletricista','CARLOS ROBERTO SEMIÃO - Eletricista','ENZO GERONIMO ALVES PEREIRA - Ajudante','HENRIQUE NASTRI SANTANA DE SOUZA - Ajudante'],
  ENGLM02: ['DANILO ANASTACIO - Motorista','MIRIAN OLIVEIRA - Eletricista','CARLOS JOSE DOS SANTOS - Eletricista','WESLEY WENDELL PEREIRA DA SILVA - Eletricista','ELIEL SOARES DE FRANCA - Eletricista','ENILDO CIRILO DA SILVA - Ajudante','NIUCIMAR FERREIRA DA SILVA - Ajudante'],
  ENGLM03: ['GENARIO DE ARGOLO RODRIGUES - Motorista','LUCAS FELIPE PRUDENCIO DE OLIVEIRA S - Eletricista','DOUGLAS DE CARVALHO - Eletricista','LERRIAN DOS SANTOS DA SILVA - Eletricista','WELINTON FERREIRA ALVES - Eletricista','JOSE LACERDA ALVES - Ajudante','JACKSON RODRIGO DE OVELAR - Ajudante'],
  ENGLM04: ['JEAN ARAUJO SILVA - Motorista','JOSE SEBASTIAO BERNARDES - Eletricista','FRANCISCO IVALDO SILVA DO NASCIMENTO - Eletricista','DOUGLAS PANICIO - Eletricista','VINICIUS SILVA PEREIRA - Eletricista','JULIO CESAR DOS SANTOS - Ajudante','LUIS HENRIQUE SOUZA DE MEDEIROS - Ajudante'],
  ENGLM05: ['ALEX SANDRO MOREIRA DOS SANTOS - Motorista','CELSO DA SILVA - Eletricista','ANDERSON COSTA CARVALHO - Eletricista','TOBIAS RIBEIRO SOARES DE MORAIS - Eletricista','PABLO PIETRO BATISTA - Eletricista','PAULO HENRIQUE DA SILVA OLIVEIRA - Eletricista','FABIO DA SILVA PINTO - Ajudante','IAGO AUGUSTO DA SILVA - Ajudante'],
  ENGLM06: ['JOSE FILHO ALVES DA SILVA - Eletricista','FERNANDO DONIZETTI LOURENCO - Motorista','KLESLEY SANTOS BRANDAO - Eletricista','RONALDO POSSIDONIO PINTO - Eletricista','GEOVANE SILVA SANTOS - Eletricista','TALLES DE ALMEIDA SANTOS - Eletricista','LUCAS RODOLFO OLIVEIRA - Ajudante','JOÃO GUILHERME SANTOS RODRIGUES - Ajudante','EMERSON DIEGO FIDELIS DA SILVA - Ajudante'],
  ENGLM07: ['MARCOS FERNANDES OZORIO - Motorista','LUIS RODRIGUES DA SILVA FILHO - Eletricista','FLAVIO DE OLIVEIRA DOS SANTOS - Eletricista','RODRIGO DA SILVA AMORIM - Eletricista','JOSE CANDIDO DE ABREU - Eletricista','JONATHAN GONÇALVES FERNANDES - Ajudante','EVERTON DE LIMA RODRIGUES - Ajudante','DAVID LUCCA OLIVEIRA SANTOS - Ajudante','JOÃO LUCAS CAVALCANTE DA SILVA - Ajudante'],
  ENGLM08: ['ALEXANDRE FERNANDES - Motorista','DANIEL HENRIQUE MATOS - Eletricista','BENICIO FRANCISCO DE OLIVEIRA - Eletricista','DANILO DE CAMPOS FERREIRA - Eletricista','JOAO VICTOR RODRIGUES SANTOS - Eletricista','JOSIMAR DOS SANTOS CAMPOS - Ajudante','GUILHERME DOS SANTOS MATIAZI - Ajudante','BRUNO CARLOS DE OLIVEIRA - Ajudante'],
  ENGLM09: ['OTAVIO CALDEIRA DE OLIVEIRA - Eletricista','WELLINGTON SANTOS PARANHOS - Eletricista','ADRIAN RODOLFO GONCALO DOS SANTOS - Eletricista','KAIQUE OLIVEIRA BATISTA DIAS - Eletricista','VICTOR EDUARDO ALVES DOS SANTOS - Eletricista','PAULO VICTOR PAIVA DA SILVA - Eletricista','LUIZ AUGUSTO DE PAULA RIBEIRO - Ajudante','LEONARDO GUSTAVO NASCIMENTO - Ajudante'],
  ENGLM10: ['MATHEUS CANDIDO NUNES DE SOUSA - Motorista','MATHEUS YAN SANTOS PAIVA - Eletricista','ANTONIO INACIO CHAVES - Eletricista','LUCAS DA SILVA LEITE - Eletricista','ANDREW ALVES BENICIO BARBOSA - Eletricista','KAIO COSTA RODRIGUES DA SILVA - Ajudante','CAIO AUGUSTO DE LIMA - Ajudante'],
  ENGLM11: ['KLAUFOR KENNEDY LIMA DA SILVA - Motorista','JULIO CESAR NOGUEIRA DE CARVALHO - Eletricista','JOSE GUILHERME DOS SANTOS SILVA - Eletricista','MARCOS VINICIUS DO CARMO AUGUSTO - Eletricista','LEONARDO DOS SANTOS DA SILVA - Eletricista','LUIZ GUSTAVO MEDEIROS VIEIRA - Ajudante','VALDERCI DOS SANTOS SILVA - Ajudante'],
  ENGLV01: ['JOSE HAILTON DOS SANTOS - Motorista','RONIVAL OLIVEIRA DOS SANTOS - Eletricista LV','MARCIO DO NASCIMENTO LUSTOSA - Eletricista LV','JOSE CLAUDIO DO NASCIMENTO LUSTOSA - Eletricista LV'],
  ENGLV02: ['EDILSON ALVES BEZERRA - Eletricista LV','GUSTAVO CHAVES DE BRITO - Eletricista LV','WANDER LÚCIO DE P. SANTOS - Eletricista LV'],
  ENGLV03: ['LEONARDO RODRIGUES SOUZA SILVA - Eletricista LV','WALLACE JUNIOR DA SILVA - Eletricista LV','EDAISIO DE JESUS SOUZA - Eletricista LV'],
  ENGLV04: ['JOSEVAL BEZERRA DEODATO - Eletricista LV','MARCIO DA SILVA GUIMARAES - Motorista','ROBSON ALEXANDRE SALES - Motorista'],
  ENGLV05: ['ISRAEL MANOEL PENA - Eletricista LV','EDELSON TAVARES DE FRANÇA - Motorista','LUCAS HENRIQUE MAIA - Motorista'],
  ENGNR01: ['JULIO CESAR CAMARGO SANTOS - Eletricista','KESLER WESLEY CONEJO CARDOSO - Motorista','DIOGO SOUZA CRUZ - Eletricista','JOSE APARECIDO DE CARVALHO - Eletricista','GIULIO CEZARI SCANDURA SANTOS - Eletricista','RAUL DE OLIVEIRA GONCALVES - Eletricista','MOISES JOAB DIAS CHAVES - Ajudante','JOAO PEDRO BRUNO - Ajudante','NICOLAS ENDREW DE SOUZA GUEDES - Ajudante'],
  ENGNR02: ['MAURILIO SILVA DOS SANTOS - Eletricista','JOSE EDUARDO DO NASCIMENTO - Eletricista','GABRIEL DE OLIVEIRA LIMA - Eletricista','IGOR CARNEIRO MESQUITA - Eletricista'],
};

// Flat member list per parceira (all teams combined, for autocomplete)
const PARCEIRA_MEMBERS = {
  ENGELMIG: [...new Set(Object.values(TEAM_MEMBERS).flat())],
};

export function getMembersByParceira(parceira) {
  return PARCEIRA_MEMBERS[parceira] ?? [];
}

// Fallback placeholder generator for teams not in TEAM_MEMBERS
const NOMES = [
  'Carlos', 'André', 'Paulo', 'Ricardo', 'Marcos',
  'Luiz', 'Fernando', 'Roberto', 'Rodrigo', 'Eduardo',
  'Felipe', 'Diego', 'Bruno', 'Gustavo', 'Antônio',
  'Sérgio', 'Alexandre', 'Rafael', 'Leandro', 'Gilson',
];

const FUNCOES = {
  B3: ['Motorista', 'Eletricista', 'Eletricista', 'Auxiliar', 'Auxiliar', 'Ajudante'],
  B2: ['Motorista', 'Eletricista', 'Auxiliar', 'Auxiliar', 'Ajudante'],
  B1: ['Motorista', 'Eletricista', 'Auxiliar'],
  C2: ['Auxiliar', 'Eletricista', 'Eletricista', 'Ajudante'],
  A3: ['Auxiliar'],
  C1: ['Auxiliar'],
  L3: ['Auxiliar'],
};

function hashSigla(sigla) {
  return sigla.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
}

export function getPlaceholderMembers(user) {
  const sigla = user?.sigla ?? '';
  const qtd = (user?.qtdColaboradores ?? 1) - 1;
  if (qtd <= 0) return [];

  if (TEAM_MEMBERS[sigla]) {
    return TEAM_MEMBERS[sigla].slice(0, qtd);
  }

  const composicao = user?.composicao ?? 'C1';
  const funcoes = FUNCOES[composicao] ?? Array(qtd).fill('Auxiliar');
  const offset = hashSigla(sigla);

  return Array.from({ length: qtd }, (_, i) => {
    const nome = NOMES[(offset + i) % NOMES.length];
    const funcao = funcoes[i] ?? 'Auxiliar';
    return `${nome} - ${funcao}`;
  });
}

// Quebra "NOME - Função" em { nome, funcao }
function parseMembro(label, id, funcaoPadrao = 'Colaborador') {
  const dash = label.lastIndexOf(' - ');
  const nome = (dash >= 0 ? label.slice(0, dash) : label).trim();
  const funcao = (dash >= 0 ? label.slice(dash + 3) : '').trim() || funcaoPadrao;
  return { id, nome, funcao };
}

// Roster COMPLETO de uma equipe para a conferência do interno:
// encarregado (líder real do cadastro) + integrantes reais, na mesma
// composição usada no fluxo do parceiro (respeita qtdColaboradores).
export function getRosterEquipe(sigla) {
  const u = MOCK_USERS[sigla] ?? {};
  const roster = [];
  if (u.nome) roster.push({ id: `${sigla}-0`, nome: u.nome, funcao: 'Encarregado' });
  getPlaceholderMembers(u).forEach((label, i) => {
    roster.push(parseMembro(label, `${sigla}-${i + 1}`));
  });
  return roster;
}
