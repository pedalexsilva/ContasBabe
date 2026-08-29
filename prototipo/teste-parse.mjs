/**
 * Testa o parser do protótipo contra o texto real de um screenshot do MB Way
 * (prototipo/exemplos/mbway-atividade.png), como manda a regra da casa:
 * nenhum parser sem fixture com texto real.
 *
 *   node prototipo/teste-parse.mjs
 *
 * O código testado é extraído do próprio index.html (bloco >>> parse), para
 * não haver duas cópias a divergir.
 */
import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'

const html = readFileSync(new URL('./index.html', import.meta.url), 'utf-8')
const bloco = /\/\/ >>> parse[\s\S]*?\n([\s\S]*?)\/\/ <<< parse/.exec(html)
assert.ok(bloco, 'não encontrei o bloco >>> parse no index.html')

const nomes = [
  'parseCent', 'formatarCent', 'parseTexto', 'lerCabecalhoData', 'sugerirEvento',
  'formatarPeriodoISO', 'calcularSaldo', 'arredondar', 'somarDias',
]
const { parseCent, formatarCent, parseTexto, lerCabecalhoData, sugerirEvento,
  formatarPeriodoISO, calcularSaldo, arredondar, somarDias } = new Function(
  bloco[1] + '\nreturn { ' + nomes.join(', ') + ' }',
)()

/* ---- parseCent: os casos do dominio/dinheiro.ts que interessam aqui ---- */

assert.equal(parseCent('0,95'), 95)
assert.equal(parseCent('0.95€'), 95)
assert.equal(parseCent('- 8,45 €'), -845)
assert.equal(parseCent('-57 €'), -5700)
assert.equal(parseCent('1.234,56'), 123456)
assert.equal(parseCent('EUR 0,95'), 95)
assert.equal(parseCent('abc'), null)
assert.equal(parseCent(''), null)

assert.equal(formatarCent(95), '0,95 €')
assert.equal(formatarCent(123456), '1.234,56 €')
assert.equal(formatarCent(-5700), '-57,00 €')

/* ---- fixture: separador Atividade, screenshot de 29/08/2026 ---- */

const fixture = `09:59
ATIVIDADE
CARTÕES MB NET
ontem
Filtrar
Pagamento com QR Code - 8,45 €
SNACK-BAR O PRESS
Pago
Pagamento com QR Code - 3,75 €
PADARIA ROYALE
Pago
27 agosto
Pagamento com QR Code - 57 €
NOLA NO LABELS PRC FILIPA
LENCAS
Pago
Pagamento com QR Code - 0,95 €
CAFE ORFEU
Pago
INÍCIO
ATIVIDADE
UP!
MAIS`

const hoje = new Date(2026, 7, 29)
const despesas = parseTexto(fixture, hoje)

assert.equal(despesas.length, 4)

assert.deepEqual(
  despesas.map((d) => [d.valorCent, d.comerciante, d.dataISO]),
  [
    [845, 'SNACK-BAR O PRESS', '2026-08-28'],
    [375, 'PADARIA ROYALE', '2026-08-28'],
    [5700, 'NOLA NO LABELS PRC FILIPA LENCAS', '2026-08-27'],
    [95, 'CAFE ORFEU', '2026-08-27'],
  ],
)

// O rawText fica guardado — é corpus, como na app a sério.
assert.match(despesas[0].rawText, /8,45/)

/* ---- degradações típicas do OCR ---- */

// "QR" lido como "OR", travessão em vez de hífen, espaços NBSP.
const garbled = `ontem
Pagamento com OR Code — 8,45 €
SNACK-BAR O PRESS
Pago`
const g = parseTexto(garbled, hoje)
assert.equal(g.length, 1)
assert.equal(g[0].valorCent, 845)

// Valor numa linha separada do cabeçalho.
const valorSeparado = `ontem
Pagamento com QR Code
- 3,75 €
PADARIA ROYALE
Pago`
const v = parseTexto(valorSeparado, hoje)
assert.equal(v.length, 1)
assert.equal(v[0].valorCent, 375)
assert.equal(v[0].comerciante, 'PADARIA ROYALE')

// Cabeçalho engolido pelo OCR: linha solta com valor negativo ainda conta.
const semCabecalho = `ontem
- 12,50 €
RESTAURANTE X
Pago`
const s = parseTexto(semCabecalho, hoje)
assert.equal(s.length, 1)
assert.equal(s[0].valorCent, 1250)

// Um saldo positivo solto não é despesa.
assert.equal(parseTexto('ontem\n123,45 €\n', hoje).length, 0)

/* ---- cicatriz real: Lidl 1,65 lido como 1.650,00 ---- */

// O € (ou um borrão) colou-se ao número como dígito e a regra dos milhares
// do parseCent fazia de "1,650" 1.650,00 €. Neste corpus um valor sem casas
// decimais nunca tem grupo de milhares, por isso lê-se como decimal de duas
// casas e fica marcado como suspeito para a revisão.
const lidl = parseTexto('ontem\nPagamento com QR Code - 1,650 €\nLIDL\nPago', hoje)
assert.equal(lidl.length, 1)
assert.equal(lidl[0].valorCent, 165)
assert.equal(lidl[0].valorSuspeito, true)
assert.equal(lidl[0].comerciante, 'LIDL')

// A mesma leitura com ponto.
const lidlPonto = parseTexto('ontem\nPagamento com QR Code - 1.650 €\nLIDL\nPago', hoje)
assert.equal(lidlPonto[0].valorCent, 165)
assert.equal(lidlPonto[0].valorSuspeito, true)

// Com casas decimais explícitas não há reinterpretação — mas um valor
// destes num pagamento QR é raro que chegue para pedir confirmação.
const grande = parseTexto('ontem\nPagamento com QR Code - 1.650,00 €\nHOTEL\nPago', hoje)
assert.equal(grande[0].valorCent, 165000)
assert.equal(grande[0].valorSuspeito, true)

// Os valores normais não são suspeitos.
assert.equal(despesas[0].valorSuspeito, false) // 8,45 €
assert.equal(despesas[2].valorSuspeito, false) // 57 €
assert.equal(parseCent('1,650'), 165000) // o gémeo do dinheiro.ts não muda

/* ---- fixture 2: OCR real de um scroll longo ---- */

// exemplos/mbway-atividade-2.ocr.txt é o texto verbatim que o Tesseract 5
// (por, 2x) tirou de exemplos/mbway-atividade-2.png. Traz as cicatrizes que o
// texto ideal nunca mostraria: o chip "Pago" lido como "&", "ontem Filtrar 2",
// as transferências para a Lisa (acertos, não despesas), "23 agosto" lido como
// "253 agosto" e "- 25 €" lido como "-295 €".
const ocrReal = readFileSync(new URL('./exemplos/mbway-atividade-2.ocr.txt', import.meta.url), 'utf-8')
const d2 = parseTexto(ocrReal, hoje)

assert.deepEqual(
  d2.map((d) => [d.valorCent, d.comerciante, d.dataISO]),
  [
    [845, 'SNACK-BAR O PRESS', '2026-08-28'],
    [375, 'PADARIA ROYALE', '2026-08-28'],
    [5700, 'NOLANOLABELS PRCFILIPA W LENCAS', '2026-08-27'],
    [95, 'CAFE ORFEU', '2026-08-27'],
    [239, 'CONTINENTE BOM DIA MASSARELOS', '2026-08-26'],
    [165, 'LIDL AGRADECE', '2026-08-26'],
    [700, 'NEGRA CAFE BOAVISTA', '2026-08-26'],
    [580, 'CONFEITARIA PETULIA', '2026-08-26'],
    // Era "- 25 €"; o OCR deu "-295 €" e não há como saber — corrige-se na
    // revisão. Limitação documentada, não regra nova.
    [29500, 'DATERRA MATOSINHOS', '2026-08-25'],
    [334, 'CBD BOM SUCESSO', '2026-08-25'],
    [390, 'CONFEITARIA PETULIA', '2026-08-25'],
    // Era "23 agosto"; recuperado como 25 e marcado para confirmar.
    [1563, 'LIDL AGRADECE', '2026-08-25'],
  ],
)

// As transferências entre os dois nunca viram despesas.
assert.ok(!d2.some((d) => /lisa|enviou|recebeu|daterra\s*\*/i.test(d.comerciante)))
assert.ok(!d2.some((d) => d.valorCent === 2000 || d.valorCent === 1250))

// O bloco do "253 agosto" fica com a data marcada; os outros não.
assert.equal(d2[11].dataSuspeita, true)
assert.ok(d2.slice(0, 11).every((d) => d.dataSuspeita === false))

/* ---- fixture 3: o circuito real de hoje ---- */

// mbway-atividade-2.browser.txt é o que o Tesseract dá pelo caminho que a app
// usa mesmo: o mesmo ficheiro vendor/, o pré-processamento da página (sem
// ampliar) e o browser. Aqui não há cicatrizes para recuperar — exige-se
// perfeição, e uma regressão no pré-processamento parte este teste.
const ocrBrowser = readFileSync(new URL('./exemplos/mbway-atividade-2.browser.txt', import.meta.url), 'utf-8')
const d3 = parseTexto(ocrBrowser, hoje)

assert.deepEqual(
  d3.map((d) => [d.valorCent, d.comerciante, d.dataISO]),
  [
    [845, 'SNACK-BAR OPRESS', '2026-08-28'],
    [375, 'PADARIA ROYALE', '2026-08-28'],
    [5700, 'NOLANOLABELS PRCFILIPA Y LENCAS', '2026-08-27'],
    [95, 'CAFE ORFEU', '2026-08-27'],
    [239, 'CONTINENTE BOM DIA MASSARELOS', '2026-08-26'],
    [165, 'LIDL AGRADECE', '2026-08-26'],
    [700, 'NEGRA CAFE BOAVISTA', '2026-08-26'],
    [580, 'CONFEITARIA PETULIA', '2026-08-26'],
    [2500, 'DATERRA MATOSINHOS', '2026-08-25'],
    [334, 'CBD BOM SUCESSO', '2026-08-25'],
    [390, 'CONFEITARIA PETULIA', '2026-08-25'],
    [1563, 'LIDL AGRADECE', '2026-08-23'],
  ],
)

// Os 134,86 € do screenshot, ao cêntimo, e nenhuma data por confirmar.
assert.equal(d3.reduce((s, d) => s + d.valorCent, 0), 13486)
assert.ok(d3.every((d) => d.dataSuspeita === false && d.valorSuspeito === false))

/* ---- lixo dos ícones nas pontas do nome ---- */

// O chip "Pago" vem como "SS" e o ícone do QR como "W": cortam-se nas pontas.
assert.equal(parseTexto('Pagamento com QR Code -7€\n> NEGRA CAFE BOAVISTA\nW', hoje)[0].comerciante,
  'NEGRA CAFE BOAVISTA')
// Mas uma letra a meio é nome a sério e fica.
assert.equal(parseTexto('Pagamento com QR Code -8,45 €\nSS\nSNACK-BAR O PRESS', hoje)[0].comerciante,
  'SNACK-BAR O PRESS')
// A barra de baixo chega numa linha só e não se cola ao comerciante.
assert.equal(parseTexto('Pagamento com QR Code -0,95 €\nCAFE ORFEU\nINÍCIO ATIVIDADE UP MAIS O IO', hoje)[0].comerciante,
  'CAFE ORFEU')

/* ---- cabeçalhos de data ---- */

assert.equal(lerCabecalhoData('hoje', hoje), '2026-08-29')
assert.equal(lerCabecalhoData('ontem', hoje), '2026-08-28')
assert.equal(lerCabecalhoData('27 agosto', hoje), '2026-08-27')
assert.equal(lerCabecalhoData('27 de agosto', hoje), '2026-08-27')
assert.equal(lerCabecalhoData('27 de agosto de 2025', hoje), '2025-08-27')
// Sem ano e "no futuro" → ano passado.
assert.equal(lerCabecalhoData('30 dezembro', new Date(2026, 0, 2)), '2025-12-30')
// Coisas que não são datas.
assert.equal(lerCabecalhoData('09:59', hoje), null)
assert.equal(lerCabecalhoData('Pago', hoje), null)
assert.equal(lerCabecalhoData('31 fevereiro', hoje), null)

/* ---- sugestão de evento pela janela de datas ---- */

const praia = { id: 'praia', nome: 'Praia', inicioISO: '2026-08-27', fimISO: '2026-08-30' }
const jantar = { id: 'jantar', nome: 'Jantar', inicioISO: '2026-08-28', fimISO: '2026-08-28' }

assert.equal(sugerirEvento('2026-08-27', [praia, jantar])?.id, 'praia')
// Janelas sobrepostas: ganha a que começou mais tarde.
assert.equal(sugerirEvento('2026-08-28', [praia, jantar])?.id, 'jantar')
// A 31 já ninguém está no período, mas os dois ainda apanham a data pela
// tolerância de três dias — e aí ganha na mesma o que começou mais tarde.
assert.equal(sugerirEvento('2026-08-31', [praia, jantar])?.id, 'jantar')
assert.equal(sugerirEvento('2026-09-03', [praia, jantar]), null)
assert.equal(sugerirEvento('2026-08-28', []), null)

/* ---- período formatado (gémeo de dominio/datas.ts) ---- */

assert.equal(formatarPeriodoISO('2026-05-08', '2026-05-12'), '8 a 12 de maio de 2026')
assert.equal(formatarPeriodoISO('2026-05-08', '2026-05-08'), '8 de maio de 2026')
assert.equal(formatarPeriodoISO('2026-08-28', '2026-09-02'), '28 de agosto a 2 de setembro de 2026')
assert.equal(formatarPeriodoISO('2025-12-30', '2026-01-02'), '30/12/2025 a 02/01/2026')

/* ---- divisão e acerto (secção 6 do plano, gémeo de dominio/saldo.ts) ---- */

const dA = (valorCent) => ({ valorCent, incluida: true, pagouId: 'a' })
const dB = (valorCent) => ({ valorCent, incluida: true, pagouId: 'b' })
const saldo = (ds, perc) => calcularSaldo(ds, perc).saldoCent

// O exemplo que o próprio plano dá: 50 e 75 a meias -> comum 125, cada um
// devia 62,50; Pedro fica a -12,50, ou seja deve 12,50 € à Lisa.
assert.equal(saldo([dA(5000), dB(7500)], 50), -1250)

assert.equal(saldo([dA(1000)], 50), 500) // B deve metade a A
assert.equal(saldo([dB(1000)], 50), -500) // A deve metade a B
assert.equal(saldo([dA(1000), dB(1000)], 50), 0) // pagaram o mesmo
assert.equal(saldo([dA(1000)], 100), 0) // é tudo dele: ninguém deve
assert.equal(saldo([dA(1000)], 0), 1000) // é tudo dela: deve tudo
assert.equal(saldo([dB(1000)], 100), -1000) // ela pagou o que era dele
assert.equal(saldo([dA(5000), dB(2000)], 60), 800)

// Sem pagouId (dados de versões anteriores) assume-se quem captura.
assert.equal(saldo([{ valorCent: 1000, incluida: true }], 50), 500)
// As descartadas não entram em nada.
assert.equal(saldo([{ valorCent: 1000, incluida: false, pagouId: 'a' }], 50), 0)

// **Um só arredondamento, sobre o bolo comum.** Arredondar despesa a despesa
// dava 67,46 € nas 12 do screenshot; a fórmula do plano dá 67,43 €. É esta.
const doScreenshot = [845, 375, 5700, 95, 239, 165, 700, 580, 2500, 334, 390, 1563].map(dA)
assert.equal(saldo(doScreenshot, 50), 6743)
assert.equal(saldo([dA(1), dA(1), dA(1)], 50), 1) // e não 3

// Nunca se perde nem se inventa um cêntimo: o que A recebe é o que B paga.
for (const perc of [0, 5, 33, 50, 60, 67, 95, 100]) {
  const r = calcularSaldo([dA(845), dB(333), dA(2539)], perc)
  assert.equal(r.totalCent, 845 + 333 + 2539)
  const contribuiuA = 845 + 2539
  assert.equal(r.saldoCent, contribuiuA - arredondar((r.comumCent * perc) / 100))
}

// soMinha: conta no total, fica fora do bolo comum.
const soMinha = { valorCent: 2000, incluida: true, pagouId: 'a', soMinha: true }
const r = calcularSaldo([dA(1000), soMinha], 50)
assert.equal(r.totalCent, 3000) // o dinheiro gastou-se todo
assert.equal(r.comumCent, 1000) // mas só metade se divide
assert.equal(r.pessoaisACent, 2000)
assert.equal(r.saldoCent, 500) // B deve metade dos 10, e nada dos 20
// Uma despesa inteiramente pessoal não gera saldo nenhum.
assert.equal(saldo([soMinha], 50), 0)

// arredondar é simétrico, para o dia em que os reembolsos entrarem negativos.
assert.equal(arredondar(2.5), 3)
assert.equal(arredondar(-2.5), -3)
assert.equal(Math.round(-2.5), -2) // o que não queremos
const negadas = doScreenshot.map((d) => ({ ...d, valorCent: -d.valorCent }))
assert.equal(saldo(negadas, 50), -saldo(doScreenshot, 50))

/* ---- tolerância de 3 dias na sugestão ---- */

const viagem = { id: 'v', nome: 'Viagem', inicioISO: '2026-08-20', fimISO: '2026-08-25', fechadoEm: null }
const jantar2 = { id: 'j', nome: 'Jantar', inicioISO: '2026-08-24', fimISO: '2026-08-24', fechadoEm: null }

assert.equal(somarDias('2026-08-25', 3), '2026-08-28')
assert.equal(somarDias('2026-12-30', 3), '2027-01-02') // atravessa o ano

assert.equal(sugerirEvento('2026-08-22', [viagem])?.id, 'v')
// O estorno do hotel, dois dias depois de a viagem acabar.
assert.equal(sugerirEvento('2026-08-27', [viagem])?.id, 'v')
assert.equal(sugerirEvento('2026-08-28', [viagem])?.id, 'v') // último dia
assert.equal(sugerirEvento('2026-08-29', [viagem]), null) // fora da tolerância
assert.equal(sugerirEvento('2026-08-19', [viagem]), null) // antes de começar
// Estar mesmo dentro do período ganha a estar só na tolerância.
assert.equal(sugerirEvento('2026-08-24', [viagem, jantar2])?.id, 'j')
assert.equal(sugerirEvento('2026-08-25', [jantar2, viagem])?.id, 'v')
// Um evento fechado nunca se sugere: já foi acertado.
assert.equal(sugerirEvento('2026-08-22', [{ ...viagem, fechadoEm: '2026-08-26T10:00:00Z' }]), null)

console.log('parse do protótipo: todos os testes passam')
