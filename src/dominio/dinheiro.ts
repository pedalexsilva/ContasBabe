/**
 * Dinheiro em cêntimos inteiros. Nunca float — nem aqui, nem no schema.
 *
 * O mesmo algoritmo existe em Kotlin (nucleo/.../Dinheiro.kt) porque o parser
 * de notificações corre do lado nativo. As duas implementações partilham a
 * bateria de casos: se mudares uma regra aqui, muda lá e nos dois testes.
 */

/**
 * Espaços que as apps de bancos usam e que são invisíveis num log:
 * NBSP, narrow NBSP, thin space, figure space, e o separador de milhares
 * "oficial" do Unicode. Se não forem normalizados antes das regex, um `\s`
 * mal afinado falha sem explicação.
 */
const ESPACOS = /[     ⁠\s]+/g

/**
 * Símbolos e códigos de moeda que aparecem colados ao valor.
 *
 * A ordem das alternativas conta: `eur(?:o|os)?` deixaria o `s` de "euros"
 * pendurado, porque o `o` casa primeiro e o `os` nunca chega a ser tentado.
 */
const MOEDA = /eur(?:os?)?|€/gi

/**
 * Converte um valor monetário em texto para cêntimos inteiros.
 *
 * Aceita `0,95`, `0.95`, `EUR 0,95`, `0.95€`, `1.234,56`, `1,234.56`, `-12,50`.
 * Devolve `null` para tudo o que não seja inequivocamente um valor monetário —
 * na captura de notificações, `null` significa "não é uma despesa", e é essa
 * severidade que trava os falsos positivos.
 */
export function parseCent(texto: string): number | null {
  if (texto == null) return null

  let s = texto.replace(MOEDA, '').replace(ESPACOS, '')
  if (s === '') return null

  let sinal = 1
  if (s.startsWith('-') || s.startsWith('−')) {
    sinal = -1
    s = s.slice(1)
  } else if (s.startsWith('+')) {
    s = s.slice(1)
  }

  if (!/^\d[\d.,]*$/.test(s)) return null

  const grupos = s.split(/[.,]/)
  if (grupos.some((g) => g === '')) return null

  const ultimo = grupos[grupos.length - 1]
  if (ultimo === undefined) return null

  // Regra que desfaz a ambiguidade de `1.234`: dinheiro tem no máximo duas
  // casas decimais, logo um separador seguido de exatamente três dígitos é
  // sempre separador de milhares. Uma ou duas casas → é o decimal.
  const ultimoEDecimal = grupos.length > 1 && (ultimo.length === 1 || ultimo.length === 2)

  let euros: string
  let centesimos: string

  if (grupos.length === 1) {
    euros = ultimo
    centesimos = '00'
  } else if (ultimoEDecimal) {
    euros = grupos.slice(0, -1).join('')
    centesimos = ultimo.padEnd(2, '0')
  } else if (ultimo.length === 3) {
    euros = grupos.join('')
    centesimos = '00'
  } else {
    return null
  }

  // Todos os separadores que sobram têm de delimitar grupos de três dígitos.
  const [inteiro, ...milhares] = ultimoEDecimal ? grupos.slice(0, -1) : grupos
  if (inteiro === undefined) return null
  if (milhares.length > 0 && inteiro.length > 3) return null
  if (milhares.some((g) => g.length !== 3)) return null

  const cent = Number(euros) * 100 + Number(centesimos)
  if (!Number.isSafeInteger(cent)) return null
  return sinal * cent
}

/**
 * `95` → `"0,95 €"`. Para leitura, nunca para cálculo.
 *
 * Formatado à mão em vez de `Intl.NumberFormat`: o agrupamento de milhares do
 * Intl depende dos dados ICU do runtime, e um Node sem ICU completo devolve
 * `1234,56 €` em vez de `1.234,56 €`. Numa app de dinheiro, a apresentação não
 * pode mudar consoante onde o código corre.
 */
export function formatarCent(cent: number): string {
  const sinal = cent < 0 ? '-' : ''
  const abs = Math.abs(cent)
  const euros = Math.trunc(abs / 100)
  const centesimos = abs % 100

  const grupos = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${sinal}${grupos},${String(centesimos).padStart(2, '0')} €`
}

/** `95` → `"0,95"`. Para pré-preencher campos de formulário. */
export function centParaInput(cent: number): string {
  return (Math.abs(cent) / 100).toFixed(2).replace('.', ',')
}
