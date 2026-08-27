/**
 * Datas de calendário, para formulários e listas.
 *
 * Formatadas à mão, pela mesma razão que o dinheiro: o resultado do `Intl` muda
 * com os dados ICU do runtime, e uma data que aparece diferente em cada
 * telemóvel é uma discussão a acontecer.
 */

function doisDigitos(n: number): string {
  return String(n).padStart(2, '0')
}

/** `2026-05-10`, o formato que `<input type="date">` usa. */
export function dataParaInput(d: Date): string {
  return `${d.getFullYear()}-${doisDigitos(d.getMonth() + 1)}-${doisDigitos(d.getDate())}`
}

/**
 * Lê o valor de um `<input type="date">` no fuso local.
 *
 * `new Date('2026-05-10')` seria interpretado como UTC e, a oeste de Greenwich,
 * daria o dia 9 — o tipo de erro que faz uma despesa cair fora do evento.
 */
export function inputParaData(s: string, momento: 'inicio' | 'fim' = 'inicio'): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const [ano, mes, dia] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const d =
    momento === 'inicio'
      ? new Date(ano, mes - 1, dia, 0, 0, 0, 0)
      : new Date(ano, mes - 1, dia, 23, 59, 59, 999)
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null
  return d
}

/** `10/05/2026` */
export function formatarData(d: Date): string {
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}/${d.getFullYear()}`
}

/** `10/05, 12:34` — nas listas, o ano só estorva. */
export function formatarDataCurta(d: Date): string {
  return `${doisDigitos(d.getDate())}/${doisDigitos(d.getMonth() + 1)}, ${doisDigitos(d.getHours())}:${doisDigitos(d.getMinutes())}`
}

/** `8 a 12 de maio de 2026`, encurtado quando o mês ou o ano se repetem. */
const MESES = [
  'janeiro',
  'fevereiro',
  'março',
  'abril',
  'maio',
  'junho',
  'julho',
  'agosto',
  'setembro',
  'outubro',
  'novembro',
  'dezembro',
]

export function formatarPeriodo(inicio: Date, fim: Date): string {
  const mesInicio = MESES[inicio.getMonth()] ?? ''
  const mesFim = MESES[fim.getMonth()] ?? ''

  if (inicio.getFullYear() === fim.getFullYear() && inicio.getMonth() === fim.getMonth()) {
    if (inicio.getDate() === fim.getDate()) {
      return `${inicio.getDate()} de ${mesInicio} de ${inicio.getFullYear()}`
    }
    return `${inicio.getDate()} a ${fim.getDate()} de ${mesInicio} de ${inicio.getFullYear()}`
  }
  if (inicio.getFullYear() === fim.getFullYear()) {
    return `${inicio.getDate()} de ${mesInicio} a ${fim.getDate()} de ${mesFim} de ${inicio.getFullYear()}`
  }
  return `${formatarData(inicio)} a ${formatarData(fim)}`
}
