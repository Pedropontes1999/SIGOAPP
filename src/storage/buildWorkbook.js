import * as XLSX from 'xlsx';

// Formata ISO string para hora no padrão brasileiro (HH:MM:SS)
function fmt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleTimeString('pt-BR');
}

// Calcula duração entre dois ISO strings e retorna HH:MM:SS
function dur(isoA, isoB) {
  if (!isoA || !isoB) return '';
  const sec = Math.round((new Date(isoB) - new Date(isoA)) / 1000);
  const h = String(Math.floor(sec / 3600)).padStart(2, '0');
  const m = String(Math.floor((sec % 3600) / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Cria worksheet a partir de array de arrays; cols define larguras das colunas
function sheet(rows, cols) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  if (cols) ws['!cols'] = cols;
  return ws;
}

// Monta workbook Excel com 7 abas: Composição, Obra, Cronograma, Localização,
// Medição Aterramento, Ficha Equipamento e DP
export function buildWorkbook(report) {
  const wb = XLSX.utils.book_new();
  const user = report.user ?? {};
  const obra = report.obra ?? {};
  const savedAt = report.savedAt ?? Date.now();
  const dataStr = new Date(savedAt).toLocaleDateString('pt-BR');
  const horaStr = new Date(savedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  // ── Aba 1: Composição ──
  XLSX.utils.book_append_sheet(wb, sheet([
    ['RELATÓRIO DE ATIVIDADE'],
    ['Data', dataStr, 'Hora', horaStr],
    [],
    ['EQUIPE'],
    ['Líder',           user.nome ?? ''],
    ['Sigla',           user.sigla ?? ''],
    ['Parceira',        user.parceira ?? ''],
    ['Composição',      user.composicao ?? ''],
    ['Tipo de Equipe',  user.tipoEquipe ?? ''],
    ['Placa',           user.placa ?? ''],
    ['Tipo de Veículo', user.tipoVeiculo ?? ''],
  ], [{ wch: 18 }, { wch: 32 }, { wch: 8 }, { wch: 16 }]), 'Composição');

  // ── Aba 2: Obra ──
  XLSX.utils.book_append_sheet(wb, sheet([
    ['OBRA'],
    ['OV / Nota',      obra['Ov/Nota'] ?? ''],
    ['Tipo',           obra['Tipo'] ?? ''],
    ['Município',      obra['Municipio'] ?? ''],
    ['Conjunto',       obra['Conjunto'] ?? ''],
    ['Empreendimento', obra['Empreendimento'] ?? ''],
    ['PEP',            obra['Pep'] ?? ''],
    ['Ordem DCD',      obra['Ordem DCD'] ?? ''],
    ['Circuitos',      obra['Circuitos'] ?? ''],
    ['Status da Obra', obra['Status da Obra'] ?? ''],
  ], [{ wch: 20 }, { wch: 50 }]), 'Obra');

  // ── Aba 3: Cronograma ──
  const cronRows = [
    ['CRONOGRAMA'],
    ['Etapa', 'Início', 'Fim', 'Duração'],
    ['Deslocamento',          fmt(report.inicioDeslocamento),      fmt(report.fimDeslocamento),      dur(report.inicioDeslocamento, report.fimDeslocamento)],
    ['Atividade',             fmt(report.inicioAtividade),         '',                               ''],
    ['Deslocamento de Volta', fmt(report.inicioDeslocamentoVolta), fmt(report.fimDeslocamentoVolta), dur(report.inicioDeslocamentoVolta, report.fimDeslocamentoVolta)],
    [],
  ];
  if (report.pausas?.length > 0) {
    cronRows.push(['PAUSAS']);
    cronRows.push(['#', 'Início', 'Fim', 'Duração', 'Motivo']);
    report.pausas.forEach((p, i) =>
      cronRows.push([i + 1, fmt(p.inicio), fmt(p.fim), dur(p.inicio, p.fim), p.motivo])
    );
    cronRows.push([]);
  }
  if (report.alteracaoExecucao) {
    cronRows.push(['Alteração de Execução', report.alteracaoExecucao]);
  }
  if (report.justificativaAlteracao) {
    cronRows.push(['Justificativa da Alteração', report.justificativaAlteracao]);
  }
  if (report.observacoesGerais) {
    cronRows.push(['Observações Gerais', report.observacoesGerais]);
  }
  XLSX.utils.book_append_sheet(wb, sheet(cronRows,
    [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 40 }]), 'Cronograma');

  // ── Aba 4: Localização ──
  const locRows = [
    ['LOCALIZAÇÃO'],
    ['Evento', 'Horário', 'Latitude', 'Longitude'],
    ...(report.eventosLocalizacao ?? []).map(ev => [
      ev.evento,
      new Date(ev.horario).toLocaleTimeString('pt-BR'),
      ev.latitude  != null ? Number(ev.latitude).toFixed(6)  : 'Não disponível',
      ev.longitude != null ? Number(ev.longitude).toFixed(6) : 'Não disponível',
    ]),
  ];
  XLSX.utils.book_append_sheet(wb, sheet(locRows,
    [{ wch: 32 }, { wch: 12 }, { wch: 16 }, { wch: 16 }]), 'Localização');

  // ── Aba 5: Ficha Medição Aterramento ──
  {
    const fma = report.dadosFichas?.[1];
    const r = [
      ['FICHA DE MEDIÇÃO DE ATERRAMENTO'],
      [],
      ['Colaborador EDP',      fma?.colaboradorEDP ?? ''],
      ['Colaborador Parceira', fma?.colaboradorParceira ?? ''],
      [],
      ['#', 'Coordenada', 'Rua / Avenida', 'Nº Ponto', 'Tipo Poste', 'Medição Final (Ω)', 'Qt. Hastes'],
    ];
    if (fma?.pontos?.length > 0) {
      fma.pontos.forEach((p, i) =>
        r.push([i + 1, p.coordenada ?? '', p.rua ?? '', p.numeroPonto ?? '', p.tipoPoste ?? '', p.medicaoFinal ?? '', p.qtHastes ?? ''])
      );
    } else {
      r.push(['', '', '', '', '', '', '']);
    }
    XLSX.utils.book_append_sheet(wb, sheet(r,
      [{ wch: 4 }, { wch: 24 }, { wch: 32 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 10 }]), 'Medição Aterramento');
  }

  // ── Aba 6: Ficha Equipamento ──
  {
    const feq = report.dadosFichas?.[2];
    const r = [
      ['FICHA DE EQUIPAMENTO'],
      [],
      ['Colaborador EDP',      feq?.colaboradorEDP ?? ''],
      ['Colaborador Parceira', feq?.colaboradorParceira ?? ''],
      [],
    ];
    // Cabeçalho + linhas de uma lista de equipamentos (aplicados ou removidos)
    const pushEquipamentos = (lista) => {
      r.push(['', 'Equipamento', 'Nº Instalação', 'Potência/Marca', 'Patrimônio/Série', 'Tipo']);
      lista.forEach(e => {
        r.push(['', e.equipment ?? '', e.installation ?? '', e.power ?? '', e.patrimony ?? '', e.type ?? 'DEFAULT']);
      });
    };

    if (feq?.pontos?.length > 0) {
      feq.pontos.forEach((p, i) => {
        r.push([`PONTO ${p.numero || i + 1}`]);
        r.push(['Número do Ponto', p.numero ?? '']);
        r.push(['Possui equipamentos aplicados?', p.possuiAplicados ?? '']);
        if (p.possuiAplicados === 'Sim' && p.aplicados?.length > 0) {
          pushEquipamentos(p.aplicados);
        }
        r.push(['Possui equipamentos removidos?', p.possuiRemovidos ?? '']);
        if (p.possuiRemovidos === 'Sim' && p.removidos?.length > 0) {
          pushEquipamentos(p.removidos);
        }
        r.push([]);
      });
    } else {
      r.push(['PONTO 1']);
      r.push(['Número do Ponto', '']);
      r.push(['Possui equipamentos aplicados?', '']);
      r.push(['Possui equipamentos removidos?', '']);
    }
    XLSX.utils.book_append_sheet(wb, sheet(r,
      [{ wch: 32 }, { wch: 20 }, { wch: 6 }, { wch: 20 }, { wch: 6 }, { wch: 20 }]), 'Ficha Equipamento');
  }

  // ── Aba 7: DP ──
  {
    const fdp = report.dadosFichas?.[3];
    const r = [
      ['DESLIGAMENTO PROGRAMADO'],
      [],
      ['Hora de Início',         fdp?.horaInicio ?? ''],
      ['Hora de Conclusão',      fdp?.horaConclusao ?? ''],
      ['Contato de Início COI',  fdp?.contatoInicioCOI ?? ''],
      ['Contato de Término COI', fdp?.contatoTerminoCOI ?? ''],
      ['Justificar Atraso',      fdp?.justificarAtraso ?? ''],
      [],
      ['Houve chave provisória?', fdp?.chaveProvisoria ?? ''],
    ];
    if (fdp?.chaveProvisoria === 'Sim') {
      r.push(['Motivo',           fdp.motivoChave ?? '']);
      r.push(['Ref. Instalação',  fdp.refInstalacaoChave ?? '']);
      r.push(['Chave retirada?',  fdp.chaveRetirada ?? '']);
      if (fdp.chaveRetirada === 'Sim')
        r.push(['Ref. Chave Retirada', fdp.refChaveRetirada ?? '']);
    }
    r.push([]);
    r.push(['Observações',          fdp?.observacoes ?? '']);
    r.push(['Colaborador EDP',      fdp?.colaboradorEDP ?? '']);
    r.push(['Colaborador Parceira', fdp?.colaboradorParceira ?? '']);
    XLSX.utils.book_append_sheet(wb, sheet(r, [{ wch: 30 }, { wch: 45 }]), 'DP');
  }

  return wb;
}
