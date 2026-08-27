import { describe, expect, it } from 'vitest'
import type { Despesa, Evento } from '../tipos'
import { anosComEventos, resumoAnual } from './dashboard'

const PEDRO = 'pedro'
const LISA = 'lisa'

let contador = 0

function evento(id: string, inicio: string, fim: string, fechado = false): Evento {
  return {
    id,
    nome: id,
    inicio: new Date(inicio),
    fim: new Date(fim),
    percentagens: { pedro: 50, lisa: 50 },
    fechadoEm: fechado ? new Date('2026-06-01T00:00:00Z') : null,
    acertadoCent: null,
  }
}

function despesa(
  eventoId: string | null,
  pagouId: string,
  euros: number,
  extra: { soMinha?: boolean; estado?: Despesa['estado'] } = {},
): Despesa {
  contador += 1
  return {
    id: `d${contador}`,
    eventoId,
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

// Alentejo: 5 dias, 500 € gastos. Lisboa: 2 dias, 200 € e ainda aberto.
const eventos = [
  evento('alentejo', '2026-05-08T00:00:00', '2026-05-12T00:00:00', true),
  evento('lisboa', '2026-07-04T00:00:00', '2026-07-05T00:00:00'),
  evento('porto', '2025-03-01T00:00:00', '2025-03-02T00:00:00', true),
]

const despesas = [
  despesa('alentejo', PEDRO, 300),
  despesa('alentejo', LISA, 200),
  despesa('lisboa', PEDRO, 150),
  despesa('lisboa', LISA, 50, { soMinha: true }),
  despesa('porto', PEDRO, 90),
  despesa(null, PEDRO, 999, { estado: 'pendente' }),
]

describe('resumoAnual', () => {
  const r = resumoAnual(despesas, eventos, 2026, PEDRO, LISA)

  it('soma o total do ano só com os eventos desse ano', () => {
    expect(r.totalCent).toBe(70000)
  })

  it('não conta despesas por tratar — ainda não são de nenhum evento', () => {
    expect(r.totalCent).not.toBe(70000 + 99900)
  })

  it('separa a parte do total que ainda pode mudar', () => {
    expect(r.totalAbertoCent).toBe(20000)
    expect(r.eventos.find((e) => e.eventoId === 'lisboa')?.aberto).toBe(true)
    expect(r.eventos.find((e) => e.eventoId === 'alentejo')?.aberto).toBe(false)
  })

  it('ordena os eventos por valor, não por data', () => {
    expect(r.eventos.map((e) => e.eventoId)).toEqual(['alentejo', 'lisboa'])
  })

  it('dá o custo por dia, que é o que compara um fim de semana com uma semana', () => {
    const alentejo = r.eventos.find((e) => e.eventoId === 'alentejo')
    const lisboa = r.eventos.find((e) => e.eventoId === 'lisboa')

    expect(alentejo?.dias).toBe(5)
    expect(alentejo?.custoPorDiaCent).toBe(10000)

    // Lisboa gastou menos no total mas é mais cara por dia — é isto que a
    // ordenação por valor sozinha esconde.
    expect(lisboa?.dias).toBe(2)
    expect(lisboa?.custoPorDiaCent).toBe(10000)
  })

  it('separa o comum do total, para as despesas pessoais não inflacionarem o partilhado', () => {
    const lisboa = r.eventos.find((e) => e.eventoId === 'lisboa')
    expect(lisboa?.totalCent).toBe(20000)
    expect(lisboa?.comumCent).toBe(15000)
  })

  it('mostra os gastos individuais por pessoa', () => {
    expect(r.pessoais[0]).toEqual({ pessoaId: PEDRO, pessoaisCent: 0 })
    expect(r.pessoais[1]).toEqual({ pessoaId: LISA, pessoaisCent: 5000 })
  })

  it('um ano sem eventos dá tudo a zero em vez de rebentar', () => {
    const vazio = resumoAnual(despesas, eventos, 2024, PEDRO, LISA)
    expect(vazio.totalCent).toBe(0)
    expect(vazio.eventos).toEqual([])
  })
})

describe('anoDoEvento e anosComEventos', () => {
  it('lista os anos do mais recente para o mais antigo, sem repetir', () => {
    expect(anosComEventos(eventos)).toEqual([2026, 2025])
  })

  it('um evento que atravessa a passagem de ano conta para o ano em que começou', () => {
    const reveillon = [evento('reveillon', '2026-12-30T00:00:00', '2027-01-02T00:00:00')]
    expect(anosComEventos(reveillon)).toEqual([2026])
  })
})
