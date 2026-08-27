import { FirebaseFirestore } from '@capacitor-firebase/firestore'
import type { Casal, Despesa, Evento, Heartbeat, NovaDespesa, PessoaId } from '../tipos'
import {
  type Mapeamento,
  casalDeDoc,
  despesaDeDoc,
  despesaParaDoc,
  eventoDeDoc,
  eventoParaDoc,
  heartbeatDeDoc,
  mapearDocumentos,
  paraTimestamp,
} from './conversores'

/**
 * Acesso ao Firestore através do SDK NATIVO (`@capacitor-firebase/*`).
 *
 * O SDK web do Firebase não entra aqui, e a razão não é estética:
 *  - o Google Sign-In é bloqueado dentro de WebViews embebidas
 *  - o SDK web teria a cache offline dele em IndexedDB, separada da cache
 *    nativa que o NotificationListenerService usa: uma despesa capturada sem
 *    rede não apareceria na UI do próprio telemóvel até haver rede
 *  - o serviço em Kotlin escreve autenticado como o utilizador do SDK nativo;
 *    com a sessão só no JavaScript, escrevia anónimo e as regras rejeitavam
 *    tudo em silêncio
 *
 * Não há escritas em lote nem transações porque não são precisas: cada operação
 * mexe num documento só. A ordem de chegada resolve-se sozinha.
 */

export const caminhos = {
  casal: (casalId: string) => `casais/${casalId}`,
  eventos: (casalId: string) => `casais/${casalId}/eventos`,
  evento: (casalId: string, eventoId: string) => `casais/${casalId}/eventos/${eventoId}`,
  despesas: (casalId: string) => `casais/${casalId}/despesas`,
  despesa: (casalId: string, despesaId: string) => `casais/${casalId}/despesas/${despesaId}`,
  heartbeats: (casalId: string) => `casais/${casalId}/heartbeats`,
  heartbeat: (casalId: string, pessoaId: PessoaId) => `casais/${casalId}/heartbeats/${pessoaId}`,
}

/**
 * Teto do listener de despesas. Nunca será atingido — uma viagem gera umas
 * dezenas de despesas — mas um listener sem limite é uma conta que só cresce.
 */
const MAX_DESPESAS = 3000

export type Cancelar = () => void

async function ouvirColecao<T>(
  reference: string,
  converter: (id: string, dados: Record<string, unknown>) => T,
  aoMudar: (r: Mapeamento<T>) => void,
  queryConstraints?: Parameters<typeof FirebaseFirestore.addCollectionSnapshotListener>[0]['queryConstraints'],
): Promise<Cancelar> {
  const callbackId = await FirebaseFirestore.addCollectionSnapshotListener(
    { reference, queryConstraints },
    (evento, erro) => {
      if (erro) {
        console.error(`[firestore] listener de ${reference}:`, erro)
        return
      }
      const snapshots = evento?.snapshots ?? []
      aoMudar(
        mapearDocumentos(
          snapshots.map((s) => ({ id: s.id, data: s.data as Record<string, unknown> | null })),
          converter,
        ),
      )
    },
  )
  return () => {
    void FirebaseFirestore.removeSnapshotListener({ callbackId })
  }
}

export async function ouvirCasal(
  casalId: string,
  aoMudar: (casal: Casal | null, erro: string | null) => void,
): Promise<Cancelar> {
  const callbackId = await FirebaseFirestore.addDocumentSnapshotListener(
    { reference: caminhos.casal(casalId) },
    (evento, erro) => {
      if (erro) return aoMudar(null, String(erro))
      const dados = evento?.snapshot.data as Record<string, unknown> | null | undefined
      if (dados == null) {
        return aoMudar(
          null,
          `O documento do casal "${casalId}" não existe. Cria-o na consola Firebase com os dois UIDs em "membros".`,
        )
      }
      try {
        aoMudar(casalDeDoc(casalId, dados), null)
      } catch (e) {
        aoMudar(null, e instanceof Error ? e.message : String(e))
      }
    },
  )
  return () => {
    void FirebaseFirestore.removeSnapshotListener({ callbackId })
  }
}

export function ouvirEventos(
  casalId: string,
  aoMudar: (r: Mapeamento<Evento>) => void,
): Promise<Cancelar> {
  return ouvirColecao(caminhos.eventos(casalId), eventoDeDoc, aoMudar, [
    { type: 'orderBy', fieldPath: 'inicio', directionStr: 'desc' },
  ])
}

export function ouvirDespesas(
  casalId: string,
  aoMudar: (r: Mapeamento<Despesa>) => void,
): Promise<Cancelar> {
  return ouvirColecao(caminhos.despesas(casalId), despesaDeDoc, aoMudar, [
    { type: 'orderBy', fieldPath: 'ocorreuEm', directionStr: 'desc' },
    { type: 'limit', limit: MAX_DESPESAS },
  ])
}

export function ouvirHeartbeats(
  casalId: string,
  aoMudar: (r: Mapeamento<Heartbeat>) => void,
): Promise<Cancelar> {
  return ouvirColecao(caminhos.heartbeats(casalId), heartbeatDeDoc, aoMudar)
}

/**
 * Descobre a que casal pertence este login, em vez de o `casalId` ser
 * configuração espalhada pelos dois telemóveis e pelo lado Kotlin. Uma leitura
 * no arranque, depois servida do cache.
 *
 * A query bate certo com a regra de segurança (`uid in membros`), que é o que
 * o Firestore exige para deixar consultar uma coleção.
 */
export async function descobrirCasal(uid: string): Promise<string | null> {
  const { snapshots } = await FirebaseFirestore.getCollection({
    reference: 'casais',
    compositeFilter: {
      type: 'and',
      queryConstraints: [
        { type: 'where', fieldPath: 'membros', opStr: 'array-contains', value: uid },
      ],
    },
    queryConstraints: [{ type: 'limit', limit: 1 }],
  })
  return snapshots[0]?.id ?? null
}

/** Sinal de vida do serviço nativo. Escrito pelo Kotlin; lido aqui. */
export async function registarHeartbeat(
  casalId: string,
  pessoaId: PessoaId,
  ultimaCapturaEm: Date | null,
): Promise<void> {
  await FirebaseFirestore.setDocument({
    reference: caminhos.heartbeat(casalId, pessoaId),
    data: {
      vistoEm: paraTimestamp(new Date()),
      ...(ultimaCapturaEm === null ? {} : { ultimaCapturaEm: paraTimestamp(ultimaCapturaEm) }),
    },
    merge: true,
  })
}

export async function criarEvento(casalId: string, evento: Omit<Evento, 'id'>): Promise<string> {
  const { reference } = await FirebaseFirestore.addDocument({
    reference: caminhos.eventos(casalId),
    data: eventoParaDoc(evento),
  })
  return reference.id
}

export async function atualizarEvento(
  casalId: string,
  eventoId: string,
  campos: Partial<Omit<Evento, 'id'>>,
): Promise<void> {
  const data: Record<string, unknown> = {}
  if (campos.nome !== undefined) data.nome = campos.nome
  if (campos.inicio !== undefined) data.inicio = paraTimestamp(campos.inicio)
  if (campos.fim !== undefined) data.fim = paraTimestamp(campos.fim)
  if (campos.percentagens !== undefined) data.percentagens = campos.percentagens
  if (campos.fechadoEm !== undefined) {
    data.fechadoEm = campos.fechadoEm === null ? null : paraTimestamp(campos.fechadoEm)
  }
  if (campos.acertadoCent !== undefined) data.acertadoCent = campos.acertadoCent

  await FirebaseFirestore.updateDocument({
    reference: caminhos.evento(casalId, eventoId),
    data,
  })
}

/** Fecha o evento, guardando o montante acertado para o histórico. */
export function fecharEvento(
  casalId: string,
  eventoId: string,
  acertadoCent: number,
): Promise<void> {
  return atualizarEvento(casalId, eventoId, { fechadoEm: new Date(), acertadoCent })
}

export function reabrirEvento(casalId: string, eventoId: string): Promise<void> {
  return atualizarEvento(casalId, eventoId, { fechadoEm: null, acertadoCent: null })
}

export async function criarDespesa(casalId: string, despesa: NovaDespesa): Promise<string> {
  const { reference } = await FirebaseFirestore.addDocument({
    reference: caminhos.despesas(casalId),
    data: despesaParaDoc(despesa),
  })
  return reference.id
}

export async function atualizarDespesa(
  casalId: string,
  despesaId: string,
  campos: Partial<Omit<Despesa, 'id'>>,
): Promise<void> {
  const data: Record<string, unknown> = {}
  for (const [chave, valor] of Object.entries(campos)) {
    if (valor === undefined) continue
    data[chave] = chave === 'ocorreuEm' ? paraTimestamp(valor as Date) : valor
  }
  await FirebaseFirestore.updateDocument({
    reference: caminhos.despesa(casalId, despesaId),
    data,
  })
}

export function confirmarDespesa(
  casalId: string,
  despesaId: string,
  eventoId: string,
): Promise<void> {
  return atualizarDespesa(casalId, despesaId, { eventoId, estado: 'confirmada' })
}

/**
 * "Não é da viagem". Marca em vez de apagar: o `rawText` continua no corpus do
 * parser, e a janela de deduplicação continua a ver este par — sem isso, uma
 * captura descartada do MB Way deixava a do Santander renascer como despesa.
 */
export function descartarDespesa(casalId: string, despesaId: string): Promise<void> {
  return atualizarDespesa(casalId, despesaId, { eventoId: null, estado: 'descartada' })
}

/** Apagar de vez existe só para enganos de registo manual. */
export function apagarDespesa(casalId: string, despesaId: string): Promise<void> {
  return FirebaseFirestore.deleteDocument({ reference: caminhos.despesa(casalId, despesaId) })
}
