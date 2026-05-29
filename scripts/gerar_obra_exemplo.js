const XLSX = require('xlsx');
const path = require('path');

const obra = {
  'Ov/Nota':             '12071306',
  'Pep':                 'X/002784',
  'Entrada':             '17/07/2019',
  'Status SAP':          '0',
  'Tipo':                'BT ZERO',
  'Diagrama':            '',
  'Prazo':               '90',
  'Parceira':            'MANSERV',
  'Municipio':           'GUARULHOS',
  'Ordem DCI':           '',
  'Data prazo final':    '15/10/2019',
  'Status da Obra':      'SUSPENSA',
  'Referencia':          '045ET005456309',
  'Ordem DCD':           '190000011124',
  'Executado':           '',
  'Data empreitamento':  '',
  'Circuitos':           'GOP-0102',
  'Ordem DCA':           '',
  'Data conclusao':      '',
  'Tipo ADS':            '',
  'Conjunto':            'GOPOUVA',
  'Ordem DCIM':          '',
  'Ano planejamento':    '',
  'Empreendimento':      'NOVA CUMBICA',
  'Observacao':          '',
};

const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet([obra]);

// Largura das colunas
ws['!cols'] = Object.keys(obra).map(() => ({ wch: 20 }));

XLSX.utils.book_append_sheet(wb, ws, 'Obra');

const outPath = path.join(__dirname, '..', 'exemplo_obra.xlsx');
XLSX.writeFile(wb, outPath);

console.log('Arquivo criado:', outPath);
