import { describe, expect, it } from 'vitest'
import type { Evento } from '../tipos'
import {
  TOLERANCIA_POS_FIM_MS,
  dentroDoPeriodo,
  duracaoDias,
  estaAtivo,
  eventosAtivos,
  eventosSugeridos,
} from './eventos'

function evento(id: string, inicio: string, fim: string, fechadoEm: Date | null = null): Evento {
  return {
    id,
    nome: id,
    inicio: new Date(inicio),
    fim: new Date(fim),
    percentagens: { pedro: 50, lisa: 50 },
    fechadoEm,
    acertadoCent: null,
  }
}

const alentejo = evento('alentejo', '2026-05-08T00:00:00Z', '2026-05-12T23:59:59Z')

describe('estaAtivo', () => {
  it('está ativo dentro do período', () => {
    expect(estaAtivo(alentejo, new Date('2026-05-10T12:00:00Z'))).toBe(true)
  })

  it('não está ativo antes de começar', () => {
    expect(estaAtivo(alentejo, new Date('2026-05-07T23:59:00Z'))).toBe(false)
  })

  it('continua ativo nos três dias a seguir ao fim', () => {
    // É aqui que chegam os reembolsos e os acertos de pré-autorização.
    expect(estaAtivo(alentejo, new Date('2026-05-14T12:00:00Z'))).toBe(true)
    const limite = new Date(alentejo.fim.getTime() + TOLERANCIA_POS_FIM_MS)
    expect(estaAtivo(alentejo, limite)).toBe(true)
  })

  it('deixa de estar ativo passada a tolerância', () => {
    const passado = new Date(alentejo.fim.getTime() + TOLERANCIA_POS_FIM_MS + 1000)
    expect(estaAtivo(alentejo, passado)).toBe(false)
  })

  it('um evento fechado nunca está ativo, mesmo a meio das datas', () => {
    const fechado = evento('x', '2026-05-08T00:00:00Z', '2026-05-12T00:00:00Z', new Date())
    expect(estaAtivo(fechado, new Date('2026-05-10T12:00:00Z'))).toBe(false)
  })
})

describe('dentroDoPeriodo', () => {
  it('é estrito: não tem a tolerância dos três dias', () => {
    expect(dentroDoPeriodo(alentejo, new Date('2026-05-10T12:00:00Z'))).toBe(true)
    expect(dentroDoPeriodo(alentejo, new Date('2026-05-14T12:00:00Z'))).toBe(false)
  })
})

describe('eventosAtivos', () => {
  it('devolve só os que estão a decorrer', () => {
    const eventos = [
      alentejo,
      evento('lisboa', '2026-05-09T00:00:00Z', '2026-05-11T00:00:00Z'),
      evento('antigo', '2025-01-01T00:00:00Z', '2025-01-05T00:00:00Z'),
    ]
    const ativos = eventosAtivos(eventos, new Date('2026-05-10T12:00:00Z'))
    expect(ativos.map((e) => e.id)).toEqual(['alentejo', 'lisboa'])
  })
})

describe('eventosSugeridos', () => {
  it('põe à frente o evento que contém a data, antes do que só a apanha na tolerância', () => {
    const acabado = evento('acabado', '2026-05-01T00:00:00Z', '2026-05-09T00:00:00Z')
    const aDecorrer = evento('a-decorrer', '2026-05-09T00:00:00Z', '2026-05-20T00:00:00Z')

    const sugeridos = eventosSugeridos([acabado, aDecorrer], new Date('2026-05-11T12:00:00Z'))
    expect(sugeridos.map((e) => e.id)).toEqual(['a-decorrer', 'acabado'])
  })

  it('não sugere eventos fechados', () => {
    const fechado = evento('fechado', '2026-05-08T00:00:00Z', '2026-05-12T00:00:00Z', new Date())
    expect(eventosSugeridos([fechado], new Date('2026-05-10T12:00:00Z'))).toEqual([])
  })

  it('sem nenhum evento na janela, não sugere nada', () => {
    expect(eventosSugeridos([alentejo], new Date('2026-06-01T12:00:00Z'))).toEqual([])
  })
})

describe('duracaoDias', () => {
  it('conta os extremos: um fim de semana são dois dias', () => {
    // Sábado a domingo.
    expect(duracaoDias(evento('fds', '2026-05-09T10:00:00', '2026-05-10T18:00:00'))).toBe(2)
  })

  it('um evento de um dia só conta um', () => {
    expect(duracaoDias(evento('dia', '2026-05-09T10:00:00', '2026-05-09T23:00:00'))).toBe(1)
  })

  it('conta dias de calendário, não períodos de 24 horas', () => {
    // 23h00 de um dia às 01h00 do seguinte são duas datas, logo dois dias.
    expect(duracaoDias(evento('noite', '2026-05-09T23:00:00', '2026-05-10T01:00:00'))).toBe(2)
  })

  it('conta uma semana como sete dias', () => {
    expect(duracaoDias(evento('semana', '2026-05-04T00:00:00', '2026-05-10T23:59:00'))).toBe(7)
  })
})
