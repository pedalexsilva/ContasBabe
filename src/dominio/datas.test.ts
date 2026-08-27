import { describe, expect, it } from 'vitest'
import { dataParaInput, formatarData, formatarDataCurta, formatarPeriodo, inputParaData } from './datas'

describe('inputParaData', () => {
  it('lê a data no fuso local, não em UTC', () => {
    // `new Date('2026-05-10')` seria meia-noite UTC e, a oeste de Greenwich,
    // daria o dia 9 — despesas a cair fora do evento por causa disso.
    const d = inputParaData('2026-05-10')
    expect(d?.getFullYear()).toBe(2026)
    expect(d?.getMonth()).toBe(4)
    expect(d?.getDate()).toBe(10)
    expect(d?.getHours()).toBe(0)
  })

  it('o fim do dia é 23:59:59.999, para o intervalo do evento incluir o último dia', () => {
    const d = inputParaData('2026-05-10', 'fim')
    expect(d?.getHours()).toBe(23)
    expect(d?.getMinutes()).toBe(59)
    expect(d?.getMilliseconds()).toBe(999)
  })

  it('recusa datas que não existem, em vez de as deslizar para o mês seguinte', () => {
    expect(inputParaData('2026-02-30')).toBeNull()
    expect(inputParaData('2026-13-01')).toBeNull()
  })

  it('aceita o 29 de fevereiro de um ano bissexto', () => {
    expect(inputParaData('2028-02-29')?.getDate()).toBe(29)
  })

  it('recusa formatos que não sejam AAAA-MM-DD', () => {
    expect(inputParaData('10/05/2026')).toBeNull()
    expect(inputParaData('')).toBeNull()
  })

  it('dá a volta com dataParaInput', () => {
    const s = '2026-05-10'
    expect(dataParaInput(inputParaData(s) as Date)).toBe(s)
  })
})

describe('formatação de datas', () => {
  it('formata em dd/mm/aaaa', () => {
    expect(formatarData(new Date(2026, 4, 10))).toBe('10/05/2026')
    expect(formatarData(new Date(2026, 0, 1))).toBe('01/01/2026')
  })

  it('nas listas mostra dia, mês e hora, sem o ano', () => {
    expect(formatarDataCurta(new Date(2026, 4, 10, 9, 5))).toBe('10/05, 09:05')
  })
})

describe('formatarPeriodo', () => {
  it('encurta quando o mês e o ano se repetem', () => {
    expect(formatarPeriodo(new Date(2026, 4, 8), new Date(2026, 4, 12))).toBe(
      '8 a 12 de maio de 2026',
    )
  })

  it('mostra os dois meses quando o período os atravessa', () => {
    expect(formatarPeriodo(new Date(2026, 4, 30), new Date(2026, 5, 2))).toBe(
      '30 de maio a 2 de junho de 2026',
    )
  })

  it('um evento de um dia não se lê como intervalo', () => {
    expect(formatarPeriodo(new Date(2026, 4, 10), new Date(2026, 4, 10, 23, 59))).toBe(
      '10 de maio de 2026',
    )
  })

  it('na passagem de ano cai para as datas completas', () => {
    expect(formatarPeriodo(new Date(2026, 11, 30), new Date(2027, 0, 2))).toBe(
      '30/12/2026 a 02/01/2027',
    )
  })
})
