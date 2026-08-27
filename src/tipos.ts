/**
 * Modelo de dados — espelha o schema Firestore de docs/plano.md secção 3.
 *
 * Duas regras que atravessam tudo:
 *  - dinheiro em cêntimos inteiros (`...Cent`), nunca em float
 *  - datas em `Date` no domínio, convertidas de/para `Timestamp` na fronteira
 *    do Firestore (dados/firestore.ts). O domínio nunca vê um Timestamp.
 */

/** Identificador estável de pessoa dentro do casal. Não é o UID do Firebase. */
export type PessoaId = string

export interface Pessoa {
  id: PessoaId
  /** UID do Firebase Auth. É o que liga o login a esta pessoa. */
  uid: string
  nome: string
}

export interface Casal {
  id: string
  /** UIDs em bruto — é o que as regras de segurança conseguem testar com `in`. */
  membros: string[]
  pessoas: Pessoa[]
}

export interface Evento {
  id: string
  nome: string
  inicio: Date
  fim: Date
  /**
   * Percentagem do bolo comum por pessoa, somando 100. Um mapa em vez de um
   * `percPedro`: assim a divisão não depende da ordem do array `pessoas` nem do
   * nome de ninguém, e uma reordenação não troca as percentagens em silêncio.
   */
  percentagens: Record<PessoaId, number>
  fechadoEm: Date | null
  acertadoCent: number | null
}

export type Origem = 'wallet' | 'mbway' | 'santander' | 'manual'

/**
 * `pendente`    — capturada automaticamente, à espera de confirmação. Caixa "Por tratar".
 *                 Não conta para saldos e tem sempre `eventoId: null`.
 * `confirmada`  — atribuída a um evento. É o único estado que entra nos saldos.
 * `descartada`  — "não é da viagem". Sai da vista mas não se apaga: mantém o
 *                 `rawText` no corpus e mantém a janela de deduplicação correta.
 */
export type EstadoDespesa = 'pendente' | 'confirmada' | 'descartada'

export interface Despesa {
  id: string
  /** Preenchido só na confirmação. `null` = está em "Por tratar". */
  eventoId: string | null
  pagouId: PessoaId
  /** Cêntimos. Negativo = reembolso. */
  valorCent: number
  descricao: string | null
  comerciante: string | null
  /** 100% desta pessoa: sai do bolo comum. */
  soMinha: boolean
  origem: Origem
  cartaoLast4: string | null
  /** Texto original da notificação. É o que permite reparar o parser sem repetir os testes. */
  rawText: string | null
  ocorreuEm: Date
  estado: EstadoDespesa
}

/** Escrita de despesa: tudo menos o id, que o Firestore atribui. */
export type NovaDespesa = Omit<Despesa, 'id'>

/** Sinal de vida do NotificationListenerService, um por telemóvel. */
export interface Heartbeat {
  pessoaId: PessoaId
  vistoEm: Date
  /** Última captura automática bem-sucedida — alimenta o alerta de parser mudo. */
  ultimaCapturaEm: Date | null
}
