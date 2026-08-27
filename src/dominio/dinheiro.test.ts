import { describe, expect, it } from 'vitest'
import { centParaInput, formatarCent, parseCent } from './dinheiro'

// Os espaços invisíveis aparecem como escapes de propósito: são o assunto de
// metade destes testes e num editor não se distinguem de um espaço normal.
const NBSP = ' ' // non-breaking space
const NNBSP = ' ' // narrow no-break space
const THIN = ' ' // thin space

describe('parseCent — formatos reais das notificações', () => {
  it('aceita a vírgula decimal do Santander', () => {
    expect(parseCent('0,95')).toBe(95)
    expect(parseCent('EUR 0,95')).toBe(95)
    expect(parseCent('12,50')).toBe(1250)
  })

  it('aceita o ponto decimal do MB Way', () => {
    expect(parseCent('0.95')).toBe(95)
    expect(parseCent('0.95€')).toBe(95)
    expect(parseCent('12.50')).toBe(1250)
  })

  it('aceita o símbolo antes ou depois, com ou sem espaço', () => {
    expect(parseCent('€ 3,20')).toBe(320)
    expect(parseCent('3,20 €')).toBe(320)
    expect(parseCent('EUR3,20')).toBe(320)
  })

  it('aceita a moeda por extenso, no singular e no plural', () => {
    expect(parseCent('3,20 eur')).toBe(320)
    expect(parseCent('1,00 euro')).toBe(100)
    expect(parseCent('3,20 euros')).toBe(320)
    expect(parseCent('3,20 EUROS')).toBe(320)
  })
})

describe('parseCent — separador de milhares', () => {
  it('trata 1.234,56 como mil duzentos e trinta e quatro euros e 56', () => {
    expect(parseCent('1.234,56')).toBe(123456)
  })

  it('trata 1,234.56 (formato inglês) da mesma maneira', () => {
    expect(parseCent('1,234.56')).toBe(123456)
  })

  it('trata um separador só, seguido de três dígitos, como milhares', () => {
    // Dinheiro tem duas casas decimais. `1.234` nunca é um euro e 234.
    expect(parseCent('1.234')).toBe(123400)
    expect(parseCent('1,234')).toBe(123400)
  })

  it('aceita mais do que um grupo de milhares', () => {
    expect(parseCent('1.234.567,89')).toBe(123456789)
  })

  it('não confunde duas casas decimais com milhares', () => {
    expect(parseCent('1,50')).toBe(150)
    expect(parseCent('1.50')).toBe(150)
  })
})

describe('parseCent — espaços invisíveis', () => {
  it('sobrevive a non-breaking space entre valor e símbolo', () => {
    expect(parseCent(`0,95${NBSP}€`)).toBe(95)
  })

  it('sobrevive a narrow no-break space nos milhares', () => {
    // É o que o Intl de pt-PT produz, e o que algumas apps copiam.
    expect(parseCent(`1${NNBSP}234,56${NBSP}€`)).toBe(123456)
  })

  it('sobrevive a thin space como separador de milhares', () => {
    expect(parseCent(`1${THIN}234,56`)).toBe(123456)
  })
})

describe('parseCent — reembolsos e sinais', () => {
  it('aceita o sinal negativo dos reembolsos', () => {
    expect(parseCent('-12,50')).toBe(-1250)
    expect(parseCent('-EUR 12,50')).toBe(-1250)
  })

  it('aceita o sinal menos tipográfico', () => {
    expect(parseCent('−12,50')).toBe(-1250)
  })

  it('aceita um mais explícito', () => {
    expect(parseCent('+12,50')).toBe(1250)
  })
})

describe('parseCent — recusa o que não é dinheiro', () => {
  it('recusa texto vazio ou só moeda', () => {
    expect(parseCent('')).toBeNull()
    expect(parseCent('EUR')).toBeNull()
    expect(parseCent('   ')).toBeNull()
  })

  it('recusa mais de duas casas decimais', () => {
    expect(parseCent('1,2345')).toBeNull()
  })

  it('recusa grupos de milhares mal formados', () => {
    expect(parseCent('1.23,45')).toBeNull()
    expect(parseCent('12.3456,78')).toBeNull()
  })

  it('recusa separadores pendurados', () => {
    expect(parseCent('1,')).toBeNull()
    expect(parseCent(',95')).toBeNull()
    expect(parseCent('1,,95')).toBeNull()
  })

  it('recusa qualquer coisa com letras pelo meio', () => {
    expect(parseCent('12 meses')).toBeNull()
    expect(parseCent('50%')).toBeNull()
  })

  it('aceita euros redondos sem casas decimais', () => {
    expect(parseCent('12')).toBe(1200)
    expect(parseCent('12€')).toBe(1200)
  })
})

describe('formatação', () => {
  it('formata em português, com ponto nos milhares e vírgula decimal', () => {
    expect(formatarCent(0)).toBe('0,00 €')
    expect(formatarCent(5)).toBe('0,05 €')
    expect(formatarCent(95)).toBe('0,95 €')
    expect(formatarCent(1250)).toBe('12,50 €')
    expect(formatarCent(123456)).toBe('1.234,56 €')
    expect(formatarCent(123456789)).toBe('1.234.567,89 €')
    expect(formatarCent(-1250)).toBe('-12,50 €')
  })

  it('não depende dos dados ICU do runtime', () => {
    // `Intl` com pt-PT usa narrow no-break space nos milhares neste Node. Se a
    // formatação passasse por lá, o mesmo saldo aparecia diferente consoante o
    // dispositivo — inaceitável numa app de dinheiro.
    expect(formatarCent(123456)).not.toContain(NNBSP)
    expect(formatarCent(123456)).not.toContain(NBSP)
  })

  it('dá a volta: formatar e voltar a ler dá o mesmo valor', () => {
    for (const cent of [0, 1, 95, 1250, 123456, 123456789]) {
      expect(parseCent(centParaInput(cent))).toBe(cent)
      expect(parseCent(formatarCent(cent))).toBe(cent)
    }
    expect(parseCent(formatarCent(-1250))).toBe(-1250)
  })
})
