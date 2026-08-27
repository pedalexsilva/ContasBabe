import type { Evento, PessoaId } from '../tipos'

/**
 * Janelas de evento. O que decide se uma captura é notificada, e a que evento
 * a caixa "Por tratar" a sugere.
 */

const DIA_MS = 24 * 60 * 60 * 1000

/**
 * Reembolsos, cauções e acertos de pré-autorização chegam depois de a viagem
 * acabar. Com um fim seco, o reembolso do hotel caía no vazio sem aviso —
 * precisamente o tipo de despesa que o modelo suporta com valores negativos.
 */
export const TOLERANCIA_POS_FIM_MS = 3 * DIA_MS

/** Estritamente dentro do período declarado, sem tolerância. */
export function dentroDoPeriodo(evento: Evento, data: Date): boolean {
  const t = data.getTime()
  return t >= evento.inicio.getTime() && t <= evento.fim.getTime()
}

/**
 * Ativo para efeitos de captura: dentro do período, ou até três dias depois do
 * fim. Um evento fechado nunca está ativo, mesmo dentro das datas.
 */
export function estaAtivo(evento: Evento, agora: Date): boolean {
  if (evento.fechadoEm !== null) return false
  const t = agora.getTime()
  return t >= evento.inicio.getTime() && t <= evento.fim.getTime() + TOLERANCIA_POS_FIM_MS
}

export function eventosAtivos(eventos: Evento[], agora: Date): Evento[] {
  return eventos.filter((e) => estaAtivo(e, agora))
}

/**
 * Os eventos a propor para uma despesa por tratar, do mais provável para o
 * menos: primeiro os que a contêm no período, depois os que só a apanham na
 * tolerância. Um evento fechado não se sugere.
 */
export function eventosSugeridos(eventos: Evento[], ocorreuEm: Date): Evento[] {
  const candidatos = eventos.filter((e) => e.fechadoEm === null && estaAtivo(e, ocorreuEm))
  return [...candidatos].sort((x, y) => {
    const dx = dentroDoPeriodo(x, ocorreuEm) ? 0 : 1
    const dy = dentroDoPeriodo(y, ocorreuEm) ? 0 : 1
    if (dx !== dy) return dx - dy
    return y.inicio.getTime() - x.inicio.getTime()
  })
}

/**
 * A percentagem do bolo comum que cabe a uma pessoa neste evento.
 *
 * Rebenta em vez de assumir 50: uma percentagem em falta é dados corrompidos, e
 * um default silencioso dividia o dinheiro de maneira errada sem ninguém dar
 * por isso.
 */
export function percentagemDe(evento: Evento, pessoaId: PessoaId): number {
  const p = evento.percentagens[pessoaId]
  if (p === undefined) {
    throw new Error(`Evento "${evento.id}" não tem percentagem definida para "${pessoaId}"`)
  }
  return p
}

/** As percentagens de um evento têm de cobrir as duas pessoas e somar 100. */
export function percentagensValidas(
  percentagens: Record<PessoaId, number>,
  pessoas: PessoaId[],
): boolean {
  const chaves = Object.keys(percentagens)
  if (chaves.length !== pessoas.length) return false
  if (!pessoas.every((p) => typeof percentagens[p] === 'number')) return false
  const soma = pessoas.reduce((s, p) => s + (percentagens[p] ?? 0), 0)
  return Math.abs(soma - 100) < 1e-9
}

/** Início do dia local, para contar dias de calendário e não períodos de 24 h. */
function diaLocal(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

/**
 * Dias de calendário que o evento ocupa, extremos incluídos: um fim de semana
 * de sábado a domingo são dois dias, não um. É o denominador do custo por dia.
 */
export function duracaoDias(evento: Evento): number {
  const dias = Math.round((diaLocal(evento.fim) - diaLocal(evento.inicio)) / DIA_MS) + 1
  return Math.max(1, dias)
}
