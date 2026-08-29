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

const { parseCent, formatarCent, parseTexto, lerCabecalhoData } = new Function(
  bloco[1] + '\nreturn { parseCent, formatarCent, parseTexto, lerCabecalhoData }',
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

console.log('parse do protótipo: todos os testes passam')
