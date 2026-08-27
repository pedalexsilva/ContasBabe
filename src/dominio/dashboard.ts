import type { Despesa, Evento, PessoaId } from '../tipos'
import { duracaoDias, percentagemDe } from './eventos'
import { calcularSaldo } from './saldo'

/**
 * Dashboard anual. Tudo calculado no cliente sobre o cache local — sem
 * agregações no servidor, sem Cloud Functions.
 */

export interface ResumoEvento {
  eventoId: string
  nome: string
  /** Tudo o que se gastou, comum e pessoal. */
  totalCent: number
  comumCent: number
  dias: number
  /** A única comparação justa entre um fim de semana e dez dias fora. */
  custoPorDiaCent: number
  /** Eventos abertos entram no total, mas marcados: o número ainda vai mudar. */
  aberto: boolean
}

export interface ResumoPessoa {
  pessoaId: PessoaId
  /** Só o que marcou como 100% seu. O resto é partilhado por definição. */
  pessoaisCent: number
}

export interface ResumoAnual {
  ano: number
  /** Total do ano, o número dominante. */
  totalCent: number
  /** A parte do total que ainda pode mudar, por vir de eventos abertos. */
  totalAbertoCent: number
  /** Ordenados por valor, que é o que responde a "onde foi o dinheiro". */
  eventos: ResumoEvento[]
  pessoais: [ResumoPessoa, ResumoPessoa]
}

/** Um evento pertence ao ano em que começou, mesmo que atravesse a passagem de ano. */
export function anoDoEvento(evento: Evento): number {
  return evento.inicio.getFullYear()
}

export function resumoAnual(
  despesas: Despesa[],
  eventos: Evento[],
  ano: number,
  pessoaA: PessoaId,
  pessoaB: PessoaId,
): ResumoAnual {
  const doAno = eventos.filter((e) => anoDoEvento(e) === ano)

  const resumos: ResumoEvento[] = doAno.map((e) => {
    const s = calcularSaldo(despesas, {
      eventoId: e.id,
      pessoaA,
      pessoaB,
      percA: percentagemDe(e, pessoaA),
    })
    const dias = duracaoDias(e)
    return {
      eventoId: e.id,
      nome: e.nome,
      totalCent: s.totalCent,
      comumCent: s.comumCent,
      dias,
      custoPorDiaCent: Math.round(s.totalCent / dias),
      aberto: e.fechadoEm === null,
    }
  })

  resumos.sort((x, y) => y.totalCent - x.totalCent || x.nome.localeCompare(y.nome, 'pt'))

  const idsDoAno = new Set(doAno.map((e) => e.id))
  const confirmadasDoAno = despesas.filter(
    (d) => d.estado === 'confirmada' && d.eventoId !== null && idsDoAno.has(d.eventoId),
  )

  const pessoais = (pessoaId: PessoaId): ResumoPessoa => ({
    pessoaId,
    pessoaisCent: confirmadasDoAno
      .filter((d) => d.pagouId === pessoaId && d.soMinha)
      .reduce((soma, d) => soma + d.valorCent, 0),
  })

  return {
    ano,
    totalCent: resumos.reduce((soma, r) => soma + r.totalCent, 0),
    totalAbertoCent: resumos.filter((r) => r.aberto).reduce((soma, r) => soma + r.totalCent, 0),
    eventos: resumos,
    pessoais: [pessoais(pessoaA), pessoais(pessoaB)],
  }
}

/** Os anos com eventos, do mais recente para o mais antigo. */
export function anosComEventos(eventos: Evento[]): number[] {
  return [...new Set(eventos.map(anoDoEvento))].sort((a, b) => b - a)
}
