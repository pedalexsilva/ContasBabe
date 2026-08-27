import { describe, expect, it } from 'vitest'
import type { Evento, Heartbeat, Pessoa } from '../tipos'
import { alertasDeSaude } from './saude'

const AGORA = new Date('2026-05-10T12:00:00Z')
const HORA = 60 * 60 * 1000
const DIA = 24 * HORA

const pessoas: Pessoa[] = [
  { id: 'pedro', uid: 'uid-pedro', nome: 'Pedro' },
  { id: 'lisa', uid: 'uid-lisa', nome: 'Lisa' },
]

function hb(pessoaId: string, vistoHaMs: number, capturaHaMs: number | null): Heartbeat {
  return {
    pessoaId,
    vistoEm: new Date(AGORA.getTime() - vistoHaMs),
    ultimaCapturaEm: capturaHaMs === null ? null : new Date(AGORA.getTime() - capturaHaMs),
  }
}

const eventoAtivo: Evento = {
  id: 'alentejo',
  nome: 'Alentejo',
  inicio: new Date('2026-05-08T00:00:00Z'),
  fim: new Date('2026-05-12T00:00:00Z'),
  percentagens: { pedro: 50, lisa: 50 },
  fechadoEm: null,
  acertadoCent: null,
}

const eventoAntigo: Evento = { ...eventoAtivo, id: 'porto', nome: 'Porto', inicio: new Date('2025-01-01T00:00:00Z'), fim: new Date('2025-01-05T00:00:00Z') }

const saudaveis = [hb('pedro', HORA, HORA), hb('lisa', HORA, 2 * HORA)]

describe('serviço morto', () => {
  it('não avisa enquanto os dois telemóveis derem sinal', () => {
    expect(alertasDeSaude(pessoas, saudaveis, [eventoAtivo], AGORA)).toEqual([])
  })

  it('avisa quando um telemóvel está calado há mais de 24 horas', () => {
    const alertas = alertasDeSaude(
      pessoas,
      [hb('pedro', HORA, HORA), hb('lisa', 30 * HORA, HORA)],
      [eventoAtivo],
      AGORA,
    )

    expect(alertas).toHaveLength(1)
    expect(alertas[0]?.tipo).toBe('servico-morto')
    expect(alertas[0]?.pessoaId).toBe('lisa')
    expect(alertas[0]?.mensagem).toContain('bateria')
  })

  it('nomeia a pessoa, porque quem vê o aviso pode ser a outra', () => {
    // O telemóvel morto é invisível para o dono; é o outro que repara.
    const alertas = alertasDeSaude(pessoas, [hb('pedro', HORA, HORA), hb('lisa', 30 * HORA, HORA)], [], AGORA)
    expect(alertas[0]?.mensagem).toContain('Lisa')
  })

  it('avisa mesmo sem nenhum evento a decorrer — o serviço morto é sempre mau', () => {
    const alertas = alertasDeSaude(pessoas, [hb('pedro', 48 * HORA, HORA), hb('lisa', HORA, HORA)], [], AGORA)
    expect(alertas.map((a) => a.tipo)).toEqual(['servico-morto'])
  })
})

describe('parser mudo', () => {
  it('avisa após sete dias sem capturas, com um evento a decorrer', () => {
    const alertas = alertasDeSaude(
      pessoas,
      [hb('pedro', HORA, 8 * DIA), hb('lisa', HORA, HORA)],
      [eventoAtivo],
      AGORA,
    )

    expect(alertas).toHaveLength(1)
    expect(alertas[0]?.tipo).toBe('parser-mudo')
    expect(alertas[0]?.mensagem).toContain('8 dias')
  })

  it('cala-se fora de viagem, onde dias sem capturas são o normal', () => {
    const alertas = alertasDeSaude(
      pessoas,
      [hb('pedro', HORA, 30 * DIA), hb('lisa', HORA, 30 * DIA)],
      [eventoAntigo],
      AGORA,
    )
    expect(alertas).toEqual([])
  })

  it('trata "nunca capturou nada" como caso à parte, com mensagem própria', () => {
    const alertas = alertasDeSaude(
      pessoas,
      [hb('pedro', HORA, null), hb('lisa', HORA, HORA)],
      [eventoAtivo],
      AGORA,
    )
    expect(alertas[0]?.tipo).toBe('parser-mudo')
    expect(alertas[0]?.mensagem).toContain('Nunca')
  })

  it('não acumula os dois alertas para a mesma pessoa', () => {
    // Serviço morto explica a falta de capturas: dizer as duas coisas é ruído.
    const alertas = alertasDeSaude(pessoas, [hb('pedro', 48 * HORA, 30 * DIA), hb('lisa', HORA, HORA)], [eventoAtivo], AGORA)
    expect(alertas).toHaveLength(1)
    expect(alertas[0]?.tipo).toBe('servico-morto')
  })
})

describe('sem heartbeat nenhum', () => {
  it('avisa que falta configurar o telemóvel', () => {
    const alertas = alertasDeSaude(pessoas, [hb('pedro', HORA, HORA)], [eventoAtivo], AGORA)

    expect(alertas).toHaveLength(1)
    expect(alertas[0]?.tipo).toBe('sem-heartbeat')
    expect(alertas[0]?.mensagem).toContain('notificações')
  })

  it('avisa pelos dois quando não há heartbeat nenhum', () => {
    expect(alertasDeSaude(pessoas, [], [], AGORA)).toHaveLength(2)
  })
})
