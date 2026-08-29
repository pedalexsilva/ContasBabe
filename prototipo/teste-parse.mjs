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

const { parseCent, formatarCent, parseTexto, lerCabecalhoData, sugerirEvento, formatarPeriodoISO, quotas, saldoDespesas } = new Function(
  bloco[1] + '\nreturn { parseCent, formatarCent, parseTexto, lerCabecalhoData, sugerirEvento, formatarPeriodoISO, quotas, saldoDespesas }',
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
assert.equal(sugerirEvento('2026-08-31', [praia, jantar]), null)
assert.equal(sugerirEvento('2026-08-28', []), null)

/* ---- período formatado (gémeo de dominio/datas.ts) ---- */

assert.equal(formatarPeriodoISO('2026-05-08', '2026-05-12'), '8 a 12 de maio de 2026')
assert.equal(formatarPeriodoISO('2026-05-08', '2026-05-08'), '8 de maio de 2026')
assert.equal(formatarPeriodoISO('2026-08-28', '2026-09-02'), '28 de agosto a 2 de setembro de 2026')
assert.equal(formatarPeriodoISO('2025-12-30', '2026-01-02'), '30/12/2025 a 02/01/2026')

/* ---- divisão e acerto ---- */

// Nenhum cêntimo se perde: a + b é sempre o valor, seja qual for a
// percentagem. É a razão de b arredondar e a ficar com o resto.
for (const valor of [95, 165, 333, 845, 5700, 1, 3]) {
  for (const perc of [0, 5, 33, 50, 60, 67, 95, 100]) {
    const q = quotas(valor, perc)
    assert.equal(q.a + q.b, valor, `${valor} a ${perc}%`)
    assert.ok(q.a >= 0 && q.b >= 0, `${valor} a ${perc}% deu quota negativa`)
  }
}

// O cêntimo ímpar cai sempre para B, por o arredondamento ser dele.
assert.deepEqual(quotas(845, 50), { a: 422, b: 423 })
assert.deepEqual(quotas(333, 50), { a: 166, b: 167 })
assert.deepEqual(quotas(1000, 60), { a: 600, b: 400 })
assert.deepEqual(quotas(1000, 100), { a: 1000, b: 0 })
assert.deepEqual(quotas(1000, 0), { a: 0, b: 1000 })

// Saldo: quem paga adianta a quota do outro.
const dA = (valorCent) => ({ valorCent, incluida: true, pagouId: 'a' })
const dB = (valorCent) => ({ valorCent, incluida: true, pagouId: 'b' })

assert.equal(saldoDespesas([dA(1000)], 50), 500) // B deve metade a A
assert.equal(saldoDespesas([dB(1000)], 50), -500) // A deve metade a B
assert.equal(saldoDespesas([dA(1000), dB(1000)], 50), 0) // pagaram o mesmo
assert.equal(saldoDespesas([dA(1000)], 100), 0) // é tudo dele: ninguém deve
assert.equal(saldoDespesas([dA(1000)], 0), 1000) // é tudo dela: deve tudo
assert.equal(saldoDespesas([dB(1000)], 100), -1000) // ela pagou o que é dele

// Sem pagouId (dados de versões anteriores) assume-se quem captura.
assert.equal(saldoDespesas([{ valorCent: 1000, incluida: true }], 50), 500)

// As excluídas não entram no acerto.
assert.equal(saldoDespesas([{ valorCent: 1000, incluida: false, pagouId: 'a' }], 50), 0)

// Uma conta a 60/40 com despesas dos dois lados.
assert.equal(saldoDespesas([dA(5000), dB(2000)], 60), 2000 - 1200)

console.log('parse do protótipo: todos os testes passam')
