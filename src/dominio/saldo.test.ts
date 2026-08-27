import { describe, expect, it } from 'vitest'
import type { Despesa, EstadoDespesa, Evento } from '../tipos'
import { calcularSaldo, calcularSaldoGlobal } from './saldo'

const PEDRO = 'pedro'
const LISA = 'lisa'
const EVENTO = 'alentejo'

let contador = 0

function despesa(
  pagouId: string,
  euros: number,
  extra: { soMinha?: boolean; estado?: EstadoDespesa; eventoId?: string | null } = {},
): Despesa {
  contador += 1
  return {
    id: `d${contador}`,
    eventoId: extra.eventoId === undefined ? EVENTO : extra.eventoId,
    pagouId,
    valorCent: Math.round(euros * 100),
    descricao: null,
    comerciante: null,
    soMinha: extra.soMinha ?? false,
    origem: 'manual',
    cartaoLast4: null,
    rawText: null,
    ocorreuEm: new Date('2026-05-10T12:00:00Z'),
    estado: extra.estado ?? 'confirmada',
  }
}

const base = { eventoId: EVENTO, pessoaA: PEDRO, pessoaB: LISA, percA: 50 }

describe('calcularSaldo — o exemplo do plano', () => {
  it('50 e 75 a meias: o Pedro deve 12,50 € à Lisa', () => {
    const s = calcularSaldo([despesa(PEDRO, 50), despesa(LISA, 75)], base)

    expect(s.comumCent).toBe(12500)
    expect(s.a.deviaCent).toBe(6250)
    expect(s.b.deviaCent).toBe(6250)
    expect(s.a.saldoCent).toBe(-1250)
    expect(s.b.saldoCent).toBe(1250)
    expect(s.devedorId).toBe(PEDRO)
    expect(s.credorId).toBe(LISA)
    expect(s.montanteCent).toBe(1250)
  })
})

describe('calcularSaldo — despesas 100% de uma pessoa', () => {
  it('sai do bolo comum e fica só no bolso de quem a fez', () => {
    // Pedro gasta 50 comuns + 30 só dele; Lisa gasta 70 comuns.
    const s = calcularSaldo(
      [despesa(PEDRO, 50), despesa(PEDRO, 30, { soMinha: true }), despesa(LISA, 70)],
      base,
    )

    expect(s.a.pagouCent).toBe(8000)
    expect(s.a.pessoaisCent).toBe(3000)
    expect(s.a.contribuiuCent).toBe(5000)
    expect(s.comumCent).toBe(12000)
    expect(s.totalCent).toBe(15000)

    // Comum 120, cada um devia 60. Pedro contribuiu 50 → deve 10.
    expect(s.a.saldoCent).toBe(-1000)
    expect(s.devedorId).toBe(PEDRO)
    expect(s.montanteCent).toBe(1000)
  })

  it('uma despesa toda pessoal não mexe no saldo', () => {
    const s = calcularSaldo([despesa(PEDRO, 42.37, { soMinha: true })], base)

    expect(s.comumCent).toBe(0)
    expect(s.totalCent).toBe(4237)
    expect(s.a.saldoCent).toBe(0)
    expect(s.devedorId).toBeNull()
  })
})

describe('calcularSaldo — arredondamento', () => {
  it('numa divisão 60/40 de valor ímpar não se perde nem se inventa um cêntimo', () => {
    // Comum = 0,01 €. 60% de 1 cêntimo = 0,6 → 1 para o Pedro, 0 para a Lisa.
    const s = calcularSaldo([despesa(PEDRO, 0.01)], { ...base, percA: 60 })

    expect(s.comumCent).toBe(1)
    expect(s.a.deviaCent + s.b.deviaCent).toBe(s.comumCent)
    expect(s.a.deviaCent).toBe(1)
    expect(s.b.deviaCent).toBe(0)
  })

  it('as duas partes somam sempre o comum, para qualquer percentagem e valor', () => {
    for (let cent = 1; cent <= 200; cent++) {
      for (const perc of [0, 1, 33.33, 50, 60, 66.67, 99, 100]) {
        const s = calcularSaldo([despesa(PEDRO, cent / 100)], { ...base, percA: perc })
        expect(s.a.deviaCent + s.b.deviaCent).toBe(s.comumCent)
        expect(s.a.saldoCent + s.b.saldoCent).toBe(0)
      }
    }
  })

  it('os dois saldos são sempre simétricos', () => {
    const s = calcularSaldo(
      [despesa(PEDRO, 33.33), despesa(LISA, 66.67), despesa(PEDRO, 0.01)],
      { ...base, percA: 33.33 },
    )
    expect(s.a.saldoCent).toBe(-s.b.saldoCent)
  })
})

describe('calcularSaldo — reembolsos', () => {
  it('um reembolso é uma despesa negativa e não precisa de caso especial', () => {
    // Pedro paga 100, é reembolsado de 30. Lisa paga 40.
    const s = calcularSaldo([despesa(PEDRO, 100), despesa(PEDRO, -30), despesa(LISA, 40)], base)

    expect(s.a.contribuiuCent).toBe(7000)
    expect(s.comumCent).toBe(11000)
    expect(s.a.deviaCent).toBe(5500)
    expect(s.a.saldoCent).toBe(1500)
    expect(s.devedorId).toBe(LISA)
  })

  it('negar todas as despesas nega exatamente o saldo', () => {
    const despesas = [despesa(PEDRO, 33.33), despesa(LISA, 12.51), despesa(PEDRO, 0.05)]
    const negadas = despesas.map((d) => ({ ...d, valorCent: -d.valorCent }))
    const opts = { ...base, percA: 60 }

    expect(calcularSaldo(negadas, opts).a.saldoCent).toBe(-calcularSaldo(despesas, opts).a.saldoCent)
  })
})

describe('calcularSaldo — o que não entra na conta', () => {
  it('ignora despesas de outros eventos', () => {
    const s = calcularSaldo(
      [despesa(PEDRO, 50), despesa(LISA, 999, { eventoId: 'outro-evento' })],
      base,
    )
    expect(s.numeroDespesas).toBe(1)
    expect(s.totalCent).toBe(5000)
  })

  it('ignora despesas pendentes — dinheiro por confirmar não conta', () => {
    const s = calcularSaldo(
      [despesa(PEDRO, 50), despesa(LISA, 80, { estado: 'pendente', eventoId: null })],
      base,
    )
    expect(s.numeroDespesas).toBe(1)
    expect(s.comumCent).toBe(5000)
  })

  it('ignora despesas descartadas, mesmo com o evento preenchido', () => {
    const s = calcularSaldo([despesa(PEDRO, 50), despesa(LISA, 80, { estado: 'descartada' })], base)
    expect(s.numeroDespesas).toBe(1)
  })

  it('um evento sem despesas dá tudo a zero e ninguém a dever', () => {
    const s = calcularSaldo([], base)
    expect(s.comumCent).toBe(0)
    expect(s.montanteCent).toBe(0)
    expect(s.devedorId).toBeNull()
    expect(s.credorId).toBeNull()
  })
})

describe('calcularSaldo — entradas inválidas', () => {
  it('rejeita percentagens fora de 0–100', () => {
    expect(() => calcularSaldo([], { ...base, percA: 101 })).toThrow(/0–100/)
    expect(() => calcularSaldo([], { ...base, percA: -1 })).toThrow(/0–100/)
    expect(() => calcularSaldo([], { ...base, percA: Number.NaN })).toThrow(/0–100/)
  })

  it('rejeita as duas pessoas iguais', () => {
    expect(() => calcularSaldo([], { ...base, pessoaB: PEDRO })).toThrow(/diferentes/)
  })

  it('rejeita, em vez de ignorar, uma despesa de um terceiro pagador', () => {
    // Ignorá-la em silêncio perdia dinheiro sem deixar rasto.
    expect(() => calcularSaldo([despesa('joao', 10)], base)).toThrow(/joao/)
  })
})

describe('calcularSaldoGlobal — o número do ecrã inicial', () => {
  function evento(id: string, fechadoEm: Date | null = null): Evento {
    return {
      id,
      nome: id,
      inicio: new Date('2026-05-08T00:00:00Z'),
      fim: new Date('2026-05-12T00:00:00Z'),
      percentagens: { [PEDRO]: 50, [LISA]: 50 },
      fechadoEm,
      acertadoCent: null,
    }
  }

  const eventos = [
    evento('alentejo'),
    evento('lisboa'),
    evento('porto-2025', new Date('2025-12-01T00:00:00Z')),
  ]

  it('soma os saldos de todos os eventos abertos', () => {
    const despesas = [
      // Alentejo: Pedro 50, Lisa 75 → Pedro −12,50
      despesa(PEDRO, 50),
      despesa(LISA, 75),
      // Lisboa: Pedro 100, Lisa 60 → Pedro +20
      despesa(PEDRO, 100, { eventoId: 'lisboa' }),
      despesa(LISA, 60, { eventoId: 'lisboa' }),
    ]

    const g = calcularSaldoGlobal(despesas, eventos, PEDRO, LISA)

    expect(g.porEvento).toHaveLength(2)
    expect(g.saldoACent).toBe(750)
    expect(g.credorId).toBe(PEDRO)
    expect(g.devedorId).toBe(LISA)
    expect(g.montanteCent).toBe(750)
  })

  it('não conta eventos já fechados — foram acertados', () => {
    const despesas = [despesa(PEDRO, 500, { eventoId: 'porto-2025' })]
    const g = calcularSaldoGlobal(despesas, eventos, PEDRO, LISA)

    expect(g.saldoACent).toBe(0)
    expect(g.devedorId).toBeNull()
  })

  it('saldos de eventos diferentes podem anular-se', () => {
    const despesas = [
      despesa(PEDRO, 100),
      despesa(LISA, 0),
      despesa(LISA, 100, { eventoId: 'lisboa' }),
      despesa(PEDRO, 0, { eventoId: 'lisboa' }),
    ]
    const g = calcularSaldoGlobal(despesas, eventos, PEDRO, LISA)

    expect(g.saldoACent).toBe(0)
    expect(g.montanteCent).toBe(0)
    expect(g.devedorId).toBeNull()
  })
})
