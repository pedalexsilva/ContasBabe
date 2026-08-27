import { Timestamp } from '@capacitor-firebase/firestore'
import type { Casal, Despesa, Evento, Heartbeat, NovaDespesa, Pessoa } from '../tipos'

/**
 * Fronteira entre o documento Firestore e o domínio.
 *
 * Duas regras, e o resto sai daqui:
 *  - datas viajam como `Timestamp`, nunca como string — precisas de ordenar e
 *    de fazer intervalos, e uma string ordena por texto
 *  - dinheiro viaja como inteiro de cêntimos
 *
 * Um documento malformado faz `throw` em vez de assumir um valor por omissão.
 * Quem lê apanha por documento (ver `mapearDocumentos`), para um registo
 * corrompido não deitar abaixo a lista inteira nem, pior, entrar na conta com
 * um zero silencioso.
 */

class DocumentoInvalido extends Error {
  constructor(campo: string, valor: unknown) {
    super(`campo "${campo}" inválido: ${JSON.stringify(valor) ?? String(valor)}`)
    this.name = 'DocumentoInvalido'
  }
}

type Dados = Record<string, unknown>

/**
 * Converte para `Date` o que quer que atravesse a ponte nativa: instância de
 * `Timestamp`, o objeto `{seconds, nanoseconds}` que ela é depois de
 * serializada, millis, ou ISO. A tolerância aqui é deliberada — do outro lado
 * está código Kotlin e um WebView, e a forma exata muda com a versão do plugin.
 */
export function paraData(v: unknown): Date | null {
  if (v == null) return null
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v
  if (typeof v === 'number') return new Date(v)
  if (typeof v === 'string') {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof v === 'object') {
    const o = v as { seconds?: unknown; nanoseconds?: unknown; toDate?: unknown }
    if (typeof o.toDate === 'function') return (o.toDate as () => Date)()
    if (typeof o.seconds === 'number') {
      const nanos = typeof o.nanoseconds === 'number' ? o.nanoseconds : 0
      return new Date(o.seconds * 1000 + Math.floor(nanos / 1e6))
    }
  }
  return null
}

export function paraTimestamp(d: Date): Timestamp {
  return Timestamp.fromDate(d)
}

function exigirData(dados: Dados, campo: string): Date {
  const d = paraData(dados[campo])
  if (d === null) throw new DocumentoInvalido(campo, dados[campo])
  return d
}

function exigirTexto(dados: Dados, campo: string): string {
  const v = dados[campo]
  if (typeof v !== 'string' || v === '') throw new DocumentoInvalido(campo, v)
  return v
}

function textoOuNulo(dados: Dados, campo: string): string | null {
  const v = dados[campo]
  if (v == null || v === '') return null
  if (typeof v !== 'string') throw new DocumentoInvalido(campo, v)
  return v
}

function exigirCent(dados: Dados, campo: string): number {
  const v = dados[campo]
  // Um float aqui significa que alguém gravou euros: nunca arredondar por
  // conta própria, porque o erro fica escondido dentro de um saldo certo.
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) throw new DocumentoInvalido(campo, v)
  return v
}

export function despesaDeDoc(id: string, dados: Dados): Despesa {
  const estado = dados.estado
  if (estado !== 'pendente' && estado !== 'confirmada' && estado !== 'descartada') {
    throw new DocumentoInvalido('estado', estado)
  }

  const origem = dados.origem
  if (origem !== 'wallet' && origem !== 'mbway' && origem !== 'santander' && origem !== 'manual') {
    throw new DocumentoInvalido('origem', origem)
  }

  const eventoId = textoOuNulo(dados, 'eventoId')
  if (estado === 'confirmada' && eventoId === null) {
    throw new DocumentoInvalido('eventoId', 'despesa confirmada sem evento')
  }

  return {
    id,
    eventoId,
    pagouId: exigirTexto(dados, 'pagouId'),
    valorCent: exigirCent(dados, 'valorCent'),
    descricao: textoOuNulo(dados, 'descricao'),
    comerciante: textoOuNulo(dados, 'comerciante'),
    soMinha: dados.soMinha === true,
    origem,
    cartaoLast4: textoOuNulo(dados, 'cartaoLast4'),
    rawText: textoOuNulo(dados, 'rawText'),
    ocorreuEm: exigirData(dados, 'ocorreuEm'),
    estado,
  }
}

export function despesaParaDoc(d: NovaDespesa): Dados {
  return {
    eventoId: d.eventoId,
    pagouId: d.pagouId,
    valorCent: d.valorCent,
    descricao: d.descricao,
    comerciante: d.comerciante,
    soMinha: d.soMinha,
    origem: d.origem,
    cartaoLast4: d.cartaoLast4,
    rawText: d.rawText,
    ocorreuEm: paraTimestamp(d.ocorreuEm),
    estado: d.estado,
  }
}

export function eventoDeDoc(id: string, dados: Dados): Evento {
  const percentagens = dados.percentagens
  if (percentagens === null || typeof percentagens !== 'object' || Array.isArray(percentagens)) {
    throw new DocumentoInvalido('percentagens', percentagens)
  }
  const mapa: Record<string, number> = {}
  for (const [pessoaId, valor] of Object.entries(percentagens as Dados)) {
    if (typeof valor !== 'number' || !Number.isFinite(valor) || valor < 0 || valor > 100) {
      throw new DocumentoInvalido(`percentagens.${pessoaId}`, valor)
    }
    mapa[pessoaId] = valor
  }

  const acertado = dados.acertadoCent
  if (acertado != null && !Number.isSafeInteger(acertado)) {
    throw new DocumentoInvalido('acertadoCent', acertado)
  }

  return {
    id,
    nome: exigirTexto(dados, 'nome'),
    inicio: exigirData(dados, 'inicio'),
    fim: exigirData(dados, 'fim'),
    percentagens: mapa,
    fechadoEm: paraData(dados.fechadoEm),
    acertadoCent: (acertado as number | null | undefined) ?? null,
  }
}

export function eventoParaDoc(e: Omit<Evento, 'id'>): Dados {
  return {
    nome: e.nome,
    inicio: paraTimestamp(e.inicio),
    fim: paraTimestamp(e.fim),
    percentagens: e.percentagens,
    fechadoEm: e.fechadoEm === null ? null : paraTimestamp(e.fechadoEm),
    acertadoCent: e.acertadoCent,
  }
}

export function casalDeDoc(id: string, dados: Dados): Casal {
  const membros = dados.membros
  if (!Array.isArray(membros) || membros.some((m) => typeof m !== 'string')) {
    throw new DocumentoInvalido('membros', membros)
  }

  const pessoas = dados.pessoas
  if (!Array.isArray(pessoas)) throw new DocumentoInvalido('pessoas', pessoas)

  const lista: Pessoa[] = pessoas.map((p, i) => {
    if (p === null || typeof p !== 'object') throw new DocumentoInvalido(`pessoas[${i}]`, p)
    const o = p as Dados
    return {
      id: exigirTexto(o, 'id'),
      uid: exigirTexto(o, 'uid'),
      nome: exigirTexto(o, 'nome'),
    }
  })

  if (lista.length !== 2) {
    throw new DocumentoInvalido('pessoas', `o casal tem de ter 2 pessoas, tem ${lista.length}`)
  }

  return { id, membros: membros as string[], pessoas: lista }
}

export function heartbeatDeDoc(id: string, dados: Dados): Heartbeat {
  return {
    pessoaId: id,
    vistoEm: exigirData(dados, 'vistoEm'),
    ultimaCapturaEm: paraData(dados.ultimaCapturaEm),
  }
}

export interface Mapeamento<T> {
  itens: T[]
  /** Documentos que não passaram na conversão. Nunca são silenciados: a UI avisa. */
  falhas: { id: string; erro: string }[]
}

/**
 * Converte uma coleção documento a documento. Um registo corrompido perde-se a
 * si próprio e ao resto de nada — mas aparece em `falhas`, porque uma despesa
 * que desaparece sem aviso é o pior resultado possível.
 */
export function mapearDocumentos<T>(
  snapshots: { id: string; data?: Dados | null }[],
  converter: (id: string, dados: Dados) => T,
): Mapeamento<T> {
  const itens: T[] = []
  const falhas: { id: string; erro: string }[] = []

  for (const s of snapshots) {
    if (s.data == null) {
      falhas.push({ id: s.id, erro: 'documento sem dados' })
      continue
    }
    try {
      itens.push(converter(s.id, s.data))
    } catch (e) {
      falhas.push({ id: s.id, erro: e instanceof Error ? e.message : String(e) })
    }
  }

  return { itens, falhas }
}
