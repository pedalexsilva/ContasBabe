/**
 * ContasBabe — versão leve: Tasker + Google Apps Script + Google Sheets.
 *
 * Recebe notificações do telemóvel por HTTP POST, extrai o valor e o
 * comerciante, deduplica, e escreve numa folha de cálculo.
 *
 * O parsing corre AQUI e não no telemóvel de propósito: quando o Santander
 * mudar o texto, corrige-se nesta janela e volta a publicar-se. Não há nada a
 * reinstalar em telemóvel nenhum.
 *
 * As funções de dinheiro e de deduplicação são um porto de `src/dominio/` e de
 * `nucleo/`. Há um teste em `src/tasker.test.ts` que corre este ficheiro contra
 * os mesmos casos das outras duas implementações — se uma regra mudar num sítio
 * e não nos outros, o teste fica vermelho.
 */

// ───────────────────────────── CONFIGURAÇÃO ─────────────────────────────

/**
 * Inventa uma palavra qualquer e põe a mesma no Tasker. Sem isto, quem
 * descobrir o URL da web app pode escrever na vossa folha.
 */
var SEGREDO = 'muda-isto-antes-de-publicar';

var FOLHA_DESPESAS = 'Despesas';
var FOLHA_EVENTOS = 'Eventos';
var FOLHA_CORPUS = 'Corpus';

/**
 * Só se grava uma despesa se houver um evento a decorrer.
 *
 * É a regra do plano, e a razão é prática: fora de viagem, cada ida ao
 * supermercado e cada café criavam uma linha pendente que ninguém pediu. Ao fim
 * de um ano são centenas de linhas para apagar à mão.
 *
 * Põe `false` se preferires capturar tudo, sempre. A folha `Corpus` regista
 * tudo de qualquer maneira — esta regra só decide o que entra nas `Despesas`.
 */
var EXIGIR_EVENTO_ATIVO = true;

/**
 * Reembolsos, cauções e acertos de pré-autorização chegam depois de a viagem
 * acabar. Com um fim seco, o reembolso do hotel caía no vazio sem aviso.
 */
var TOLERANCIA_POS_FIM_MS = 3 * 24 * 60 * 60 * 1000;

/** Mesma janela do plano: mediram-se 45 s entre o MB Way e o Santander. */
var JANELA_MS = 3 * 60 * 1000;

/** Quantas linhas recentes ler para decidir se é duplicado. */
var LINHAS_DEDUP = 40;

// ─────────────────────────────── DINHEIRO ───────────────────────────────

/**
 * Espaços invisíveis que as apps de bancos usam: NBSP, narrow NBSP, thin,
 * figure, punctuation space e word joiner. Sem isto, `1 234,56` falha sem
 * explicação nenhuma.
 */
var ESPACOS = /[\u00A0\u202F\u2009\u2007\u2008\u2060\s]+/g;

/**
 * A ordem conta: `eur(?:o|os)?` deixaria o `s` de "euros" pendurado, porque o
 * `o` casa primeiro e o `os` nunca chega a ser tentado.
 */
var MOEDA = /eur(?:os?)?|€/gi;

/**
 * Texto → cêntimos inteiros. `null` significa "isto não é um valor monetário",
 * e é essa severidade que trava os falsos positivos.
 */
function parseCent(texto) {
  if (texto === null || texto === undefined) return null;

  var s = String(texto).replace(MOEDA, '').replace(ESPACOS, '');
  if (s === '') return null;

  var sinal = 1;
  if (s.charAt(0) === '-' || s.charAt(0) === '−') {
    sinal = -1;
    s = s.slice(1);
  } else if (s.charAt(0) === '+') {
    s = s.slice(1);
  }

  if (!/^\d[\d.,]*$/.test(s)) return null;

  var grupos = s.split(/[.,]/);
  for (var i = 0; i < grupos.length; i++) {
    if (grupos[i] === '') return null;
  }

  var ultimo = grupos[grupos.length - 1];
  // Dinheiro tem no máximo duas casas decimais, logo um separador seguido de
  // exatamente três dígitos é sempre separador de milhares. `1.234` = 1234 €.
  var ultimoEDecimal = grupos.length > 1 && (ultimo.length === 1 || ultimo.length === 2);

  var euros, centesimos;
  if (grupos.length === 1) {
    euros = ultimo;
    centesimos = '00';
  } else if (ultimoEDecimal) {
    euros = grupos.slice(0, -1).join('');
    centesimos = ultimo.length === 1 ? ultimo + '0' : ultimo;
  } else if (ultimo.length === 3) {
    euros = grupos.join('');
    centesimos = '00';
  } else {
    return null;
  }

  var milhares = ultimoEDecimal ? grupos.slice(0, -1) : grupos;
  if (milhares.length > 1 && milhares[0].length > 3) return null;
  for (var j = 1; j < milhares.length; j++) {
    if (milhares[j].length !== 3) return null;
  }

  var cent = Number(euros) * 100 + Number(centesimos);
  if (!isFinite(cent) || Math.floor(cent) !== cent || cent > 9007199254740991) return null;
  return sinal * cent;
}

/**
 * `95` → `"0,95 €"`. À mão, e não com `toLocaleString`: o pt-PT do CLDR usa
 * narrow no-break space nos milhares e o resultado muda com o runtime.
 */
function formatarCent(cent) {
  var sinal = cent < 0 ? '-' : '';
  var abs = Math.abs(cent);
  var euros = String(Math.floor(abs / 100)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  var resto = String(abs % 100);
  return sinal + euros + ',' + (resto.length === 1 ? '0' + resto : resto) + ' €';
}

// ──────────────────────────────── PARSERS ────────────────────────────────

function normalizarEspacos(texto) {
  return String(texto).replace(ESPACOS, ' ').replace(/^ | $/g, '');
}

/** Minúsculas e sem acentos, para `autorização` bater com `autorizacao`. */
function normalizar(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Os `pacote` são palpites até serem confirmados no telemóvel. No Tasker vês o
 * nome da app na lista quando crias o perfil — é o sítio mais fácil de o
 * confirmar, e muda só aqui.
 */
var PARSERS = [
  {
    origem: 'santander',
    primaria: false,
    pacote: 'pt.santandertotta.mobileapp',
    /**
     * Texto real:
     *   Movimento no valor de EUR 0,95 no cartão ***********0390
     *
     * Exige a estrutura completa — valor E cartão. Um número solto numa
     * notificação promocional não chega para criar uma despesa.
     */
    parse: function (n) {
      var completo = normalizar(n.titulo + '\n' + n.texto);
      // 3D Secure: autorização de uma compra que ainda não aconteceu. Traz
      // valor e cartão na mesma, por isso só se distingue pelo vocabulário.
      var tresD = ['autorizar', 'autorizacao', 'confirmar', 'codigo', '3d secure', 'nao reconhece'];
      for (var i = 0; i < tresD.length; i++) {
        if (completo.indexOf(tresD[i]) !== -1) return null;
      }

      var m = /no valor de\s+EUR\s*([\d.,]+)[\s\S]*?cart[ãa]o\s*\*+(\d{4})/i.exec(
        normalizarEspacos(n.texto)
      );
      if (!m) return null;

      var cent = parseCent(m[1]);
      if (cent === null) return null;

      return { valorCent: cent, comerciante: null, cartaoLast4: m[2], origem: 'santander' };
    },
  },
  {
    origem: 'mbway',
    primaria: true,
    pacote: 'pt.sibs.android.mbway',
    /**
     * Texto real:
     *   Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.
     *
     * A âncora do comerciante é `, no valor de` e não a primeira vírgula —
     * `CAFE ORFEU, LDA` tem vírgula no nome.
     */
    parse: function (n) {
      var completo = normalizar(n.titulo + '\n' + n.texto);
      var transf = ['transferencia', 'transferiu'];
      for (var i = 0; i < transf.length; i++) {
        if (completo.indexOf(transf[i]) !== -1) return null;
      }

      var m = /no comerciante\s+([\s\S]+?),\s*no valor de\s*([\d.,]+)\s*€/i.exec(
        normalizarEspacos(n.texto)
      );
      if (!m) return null;

      var cent = parseCent(m[2]);
      if (cent === null) return null;

      var comerciante = m[1].replace(/\s+/g, ' ').replace(/^ | $/g, '');
      if (comerciante === '') return null;

      return { valorCent: cent, comerciante: comerciante, cartaoLast4: null, origem: 'mbway' };
    },
  },
  {
    origem: 'wallet',
    primaria: true,
    pacote: 'com.google.android.apps.walletnfcrel',
    /**
     * STUB DELIBERADO. O texto da Google Wallet ainda não foi recolhido, e a
     * regra do projeto é que nenhum parser se escreve sem o texto real.
     *
     * Enquanto isto devolver `null`, as notificações da Wallet continuam a ser
     * gravadas na folha `Corpus` — é de lá que sai o texto para escrever isto.
     */
    parse: function () {
      return null;
    },
  },
];

function analisar(n) {
  for (var i = 0; i < PARSERS.length; i++) {
    if (PARSERS[i].pacote === n.pacote) return PARSERS[i].parse(n);
  }
  return null;
}

function ePrimaria(origem) {
  for (var i = 0; i < PARSERS.length; i++) {
    if (PARSERS[i].origem === origem) return PARSERS[i].primaria;
  }
  return false; // manual
}

// ────────────────────────────── DEDUPLICAÇÃO ──────────────────────────────

/**
 * Decide o que fazer com uma captura nova. Função pura — quem chama é que fala
 * com a folha.
 *
 * As candidatas TÊM de incluir as descartadas: sem isso, descartar a captura do
 * MB Way deixava a do Santander, 45 segundos depois, renascer como despesa.
 */
function decidir(nova, pagouId, ocorreuEmMs, candidatas) {
  var par = null;
  var maisPerto = Infinity;

  for (var i = 0; i < candidatas.length; i++) {
    var c = candidatas[i];
    if (c.valorCent !== nova.valorCent || c.pagouId !== pagouId) continue;
    var distancia = Math.abs(ocorreuEmMs - c.ocorreuEmMs);
    if (distancia > JANELA_MS || distancia >= maisPerto) continue;
    maisPerto = distancia;
    par = c;
  }

  if (par === null) return { acao: 'criar' };

  // Qualquer par que não seja Santander ganha ao Santander — incluindo um
  // registo manual. Se escreveste o café à mão, a notificação 40 segundos
  // depois é a mesma compra.
  if (nova.origem === 'santander' && par.origem !== 'santander') {
    return {
      acao: 'descartar',
      linha: par.linha,
      last4: par.cartaoLast4 ? null : nova.cartaoLast4,
    };
  }

  // O par não traz comerciante e a nova traz: é um ganho, e criar outra
  // despesa seria duplicá-la.
  if (ePrimaria(nova.origem) && !ePrimaria(par.origem)) {
    return { acao: 'enriquecer', linha: par.linha };
  }

  // Duas primárias, ou dois Santander: são duas compras reais iguais em rondas
  // seguidas. Na dúvida, criar — um duplicado apaga-se num toque, uma despesa
  // engolida nunca mais aparece.
  return { acao: 'criar' };
}

// ──────────────────────────────── EVENTOS ────────────────────────────────

/**
 * Ativo para efeitos de captura: dentro do período, ou até três dias depois do
 * fim. Um evento fechado nunca está ativo, mesmo a meio das datas.
 *
 * O `fim` conta como **dia inteiro**: quem escreve "8 a 12 de maio" quer o dia
 * 12 incluído, e uma célula de data no Sheets vale meia-noite.
 */
function estaAtivo(evento, agoraMs) {
  if (evento.fechado) return false;
  var fimDoDia = evento.fimMs + 24 * 60 * 60 * 1000 - 1;
  return agoraMs >= evento.inicioMs && agoraMs <= fimDoDia + TOLERANCIA_POS_FIM_MS;
}

function eventosAtivos(eventos, agoraMs) {
  var ativos = [];
  for (var i = 0; i < eventos.length; i++) {
    if (estaAtivo(eventos[i], agoraMs)) ativos.push(eventos[i]);
  }
  return ativos;
}

/** Aceita uma célula de data do Sheets ou um texto, e devolve millis ou null. */
function paraMs(valor) {
  if (valor instanceof Date) return valor.getTime();
  if (typeof valor === 'number' && isFinite(valor)) return valor;
  if (typeof valor === 'string' && valor !== '') {
    var d = new Date(valor);
    return isNaN(d.getTime()) ? null : d.getTime();
  }
  return null;
}

function lerEventos(f) {
  var ultima = f.getLastRow();
  if (ultima < 2) return [];

  var valores = f.getRange(2, 1, ultima - 1, 5).getValues();
  var eventos = [];

  for (var i = 0; i < valores.length; i++) {
    var v = valores[i];
    var nome = String(v[0] || '').replace(/^\s+|\s+$/g, '');
    var inicioMs = paraMs(v[1]);
    var fimMs = paraMs(v[2]);
    if (nome === '' || inicioMs === null || fimMs === null) continue;

    eventos.push({
      nome: nome,
      inicioMs: inicioMs,
      fimMs: fimMs,
      percPrimeira: Number(v[3]) || 50,
      fechado: v[4] === true || String(v[4]).toLowerCase() === 'sim',
    });
  }
  return eventos;
}

// ─────────────────────────────── A FOLHA ───────────────────────────────

var COL = {
  ocorreuEm: 1,
  pagou: 2,
  valorCent: 3,
  valor: 4,
  comerciante: 5,
  descricao: 6,
  origem: 7,
  cartaoLast4: 8,
  soMinha: 9,
  evento: 10,
  estado: 11,
  rawText: 12,
};

var CABECALHOS = [
  'Quando', 'Pagou', 'Cêntimos', 'Valor', 'Comerciante', 'Descrição',
  'Origem', 'Cartão', '100% minha', 'Evento', 'Estado', 'Texto original',
];

var CABECALHOS_EVENTOS = ['Nome', 'Início', 'Fim (inclusive)', '% da 1ª pessoa', 'Fechado'];

var CABECALHOS_CORPUS = ['Quando', 'Pessoa', 'Pacote', 'Título', 'Texto', 'Resultado'];

function folha(nome, cabecalhos) {
  var livro = SpreadsheetApp.getActiveSpreadsheet();
  var f = livro.getSheetByName(nome);
  if (f === null) {
    f = livro.insertSheet(nome);
    f.appendRow(cabecalhos);
    f.setFrozenRows(1);
    f.getRange(1, 1, 1, cabecalhos.length).setFontWeight('bold');
  }
  return f;
}

function candidatasDedup(f, pagouId) {
  var ultima = f.getLastRow();
  if (ultima < 2) return [];

  var primeira = Math.max(2, ultima - LINHAS_DEDUP + 1);
  var valores = f.getRange(primeira, 1, ultima - primeira + 1, CABECALHOS.length).getValues();
  var candidatas = [];

  for (var i = 0; i < valores.length; i++) {
    var v = valores[i];
    if (v[COL.pagou - 1] !== pagouId) continue;
    var quando = v[COL.ocorreuEm - 1];
    if (!(quando instanceof Date)) continue;
    candidatas.push({
      linha: primeira + i,
      valorCent: Number(v[COL.valorCent - 1]),
      pagouId: v[COL.pagou - 1],
      ocorreuEmMs: quando.getTime(),
      origem: v[COL.origem - 1],
      cartaoLast4: v[COL.cartaoLast4 - 1] || null,
      estado: v[COL.estado - 1],
    });
  }
  return candidatas;
}

// ──────────────────────────────── HTTP ────────────────────────────────

function resposta(objeto) {
  return ContentService.createTextOutput(JSON.stringify(objeto)).setMimeType(
    ContentService.MimeType.JSON
  );
}

/**
 * O Tasker chama isto. Só faz POST — uma web app do Apps Script publicada
 * como "qualquer pessoa" não tem outra autenticação senão o segredo.
 */
function doPost(e) {
  var dados;
  try {
    dados = JSON.parse(e.postData.contents);
  } catch (erro) {
    return resposta({ ok: false, erro: 'corpo não é JSON' });
  }

  if (dados.segredo !== SEGREDO) {
    return resposta({ ok: false, erro: 'segredo errado' });
  }

  var n = {
    pacote: String(dados.pacote || ''),
    titulo: String(dados.titulo || ''),
    texto: String(dados.texto || ''),
  };
  var pagouId = String(dados.pessoa || 'desconhecido');
  var ocorreuEmMs = dados.quando ? Number(dados.quando) * 1000 : Date.now();
  if (!isFinite(ocorreuEmMs) || ocorreuEmMs <= 0) ocorreuEmMs = Date.now();

  // Fase 0 de graça: TUDO fica registado, haja evento ou não, reconhecido ou
  // não. É daqui que sai o texto para escrever o parser da Wallet e para
  // confirmar os packages — e por isso não pode depender de nenhuma das
  // decisões que vêm a seguir.
  var corpus = folha(FOLHA_CORPUS, CABECALHOS_CORPUS);
  corpus.appendRow([new Date(ocorreuEmMs), pagouId, n.pacote, n.titulo, n.texto, '']);
  var linhaCorpus = corpus.getLastRow();

  function terminar(resultado, extra) {
    corpus.getRange(linhaCorpus, 6).setValue(resultado);
    extra.ok = true;
    extra.resultado = resultado;
    return resposta(extra);
  }

  var captura = analisar(n);
  if (captura === null) {
    return terminar('não reconhecido', { reconhecido: false });
  }

  // Um lock só: duas notificações da mesma compra chegam com segundos de
  // diferença, e sem isto podiam ler a folha antes de a outra escrever.
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000);
  } catch (erro) {
    return resposta({ ok: false, erro: 'a folha está ocupada' });
  }

  try {
    var ativos = eventosAtivos(lerEventos(folha(FOLHA_EVENTOS, CABECALHOS_EVENTOS)), ocorreuEmMs);

    if (EXIGIR_EVENTO_ATIVO && ativos.length === 0) {
      return terminar('sem evento ativo', { reconhecido: true, guardado: false });
    }

    var f = folha(FOLHA_DESPESAS, CABECALHOS);
    var decisao = decidir(captura, pagouId, ocorreuEmMs, candidatasDedup(f, pagouId));

    if (decisao.acao === 'descartar') {
      if (decisao.last4) f.getRange(decisao.linha, COL.cartaoLast4).setValue(decisao.last4);
      return terminar('duplicado descartado (linha ' + decisao.linha + ')', {
        linha: decisao.linha,
      });
    }

    if (decisao.acao === 'enriquecer') {
      if (captura.comerciante) {
        f.getRange(decisao.linha, COL.comerciante).setValue(captura.comerciante);
      }
      f.getRange(decisao.linha, COL.origem).setValue(captura.origem);
      return terminar('enriqueceu a linha ' + decisao.linha, { linha: decisao.linha });
    }

    // Com um evento só a decorrer não há dúvida nenhuma a resolver, e
    // pré-preencher poupa o trabalho de o escrever à mão. Com vários, fica
    // vazio: escolher por ti seria adivinhar.
    //
    // Continua `pendente` de qualquer forma — só entra no saldo depois de
    // alguém confirmar.
    var evento = ativos.length === 1 ? ativos[0].nome : '';

    var linha = f.getLastRow() + 1;
    f.appendRow([
      new Date(ocorreuEmMs),
      pagouId,
      captura.valorCent,
      '', // preenchido a seguir com a fórmula
      captura.comerciante || '',
      '',
      captura.origem,
      captura.cartaoLast4 || '',
      false,
      evento,
      'pendente',
      n.titulo + ' | ' + n.texto,
    ]);
    // O valor legível é derivado dos cêntimos, nunca o contrário.
    f.getRange(linha, COL.valor).setFormula('=C' + linha + '/100');
    f.getRange(linha, COL.valor).setNumberFormat('#,##0.00 [$€-pt-PT]');

    return terminar('despesa criada (linha ' + linha + ')', {
      linha: linha,
      evento: evento,
      texto: (captura.comerciante || 'Compra') + ' — ' + formatarCent(captura.valorCent),
    });
  } finally {
    lock.releaseLock();
  }
}

/**
 * Abrir o URL da web app no browser mostra isto. Serve para confirmar que a
 * publicação funcionou e — o que mais interessa no dia a dia — para saber se o
 * script considera algum evento a decorrer neste momento.
 */
function doGet() {
  var ativos = eventosAtivos(lerEventos(folha(FOLHA_EVENTOS, CABECALHOS_EVENTOS)), Date.now());
  var nomes = [];
  for (var i = 0; i < ativos.length; i++) nomes.push(ativos[i].nome);

  return resposta({
    ok: true,
    servico: 'ContasBabe',
    exigeEventoAtivo: EXIGIR_EVENTO_ATIVO,
    eventosAtivos: nomes,
    aviso:
      EXIGIR_EVENTO_ATIVO && nomes.length === 0
        ? 'Sem evento a decorrer: as compras vão para o Corpus mas não criam despesas.'
        : null,
  });
}

/**
 * Corre isto uma vez a partir do editor (menu Executar): cria as três folhas e
 * mostra o que o parser extrai dos textos reais, sem envolver o telemóvel.
 */
function testarAqui() {
  folha(FOLHA_DESPESAS, CABECALHOS);
  folha(FOLHA_EVENTOS, CABECALHOS_EVENTOS);
  folha(FOLHA_CORPUS, CABECALHOS_CORPUS);

  var casos = [
    {
      pacote: 'pt.sibs.android.mbway',
      titulo: 'Compra QRCode',
      texto: 'Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.',
    },
    {
      pacote: 'pt.santandertotta.mobileapp',
      titulo: 'Santander',
      texto: 'Movimento no valor de EUR 0,95 no cartão ***********0390',
    },
  ];

  for (var i = 0; i < casos.length; i++) {
    var r = analisar(casos[i]);
    Logger.log(casos[i].pacote + ' → ' + (r ? JSON.stringify(r) : 'não reconhecido'));
  }

  var ativos = eventosAtivos(lerEventos(folha(FOLHA_EVENTOS, CABECALHOS_EVENTOS)), Date.now());
  Logger.log('Eventos a decorrer agora: ' + ativos.length);
  if (EXIGIR_EVENTO_ATIVO && ativos.length === 0) {
    Logger.log(
      'ATENÇÃO: sem uma linha na folha "Eventos" com datas que incluam hoje, as compras ' +
        'vão só para o Corpus e não criam despesas. É de propósito — ver EXIGIR_EVENTO_ATIVO.'
    );
  }
}
