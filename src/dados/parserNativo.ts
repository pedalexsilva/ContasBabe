import { Capacitor, registerPlugin } from '@capacitor/core'

/**
 * Ponte para o parser em Kotlin, só para o ecrã de debug.
 *
 * O parsing a sério nunca passa por aqui: acontece dentro do
 * NotificationListenerService, com a app fechada. Isto existe para que, quando
 * o Santander mudar o texto, se possa colar o texto novo e ver logo onde falha
 * — sem esperar por outra compra.
 */

export interface PedidoParse {
  pacote: string
  titulo: string
  texto: string
}

export interface ResultadoParse {
  reconhecido: boolean
  origem: string | null
  valorCent: number | null
  comerciante: string | null
  cartaoLast4: string | null
  /** Porque é que não reconheceu, quando não reconheceu. */
  motivo: string | null
}

export interface ParserPlugin {
  analisar(pedido: PedidoParse): Promise<ResultadoParse>
  /** Os pacotes que os parsers aceitam, para o ecrã de debug os oferecer. */
  pacotesConhecidos(): Promise<{ pacotes: { origem: string; pacote: string }[] }>

  /** Se for `false`, a app está cega — e o sistema não avisa disso em lado nenhum. */
  temAcessoNotificacoes(): Promise<{ autorizado: boolean }>
  abrirDefinicoesNotificacoes(): Promise<void>
  abrirDefinicoesBateria(): Promise<void>

  estadoCorpus(): Promise<{ linhas: number; bytes: number }>
  partilharCorpus(): Promise<void>
  limparCorpus(): Promise<void>
}

export const ParserNativo = registerPlugin<ParserPlugin>('Parser')

/** Fora do Android não há Kotlin nenhum do outro lado da ponte. */
export function parserDisponivel(): boolean {
  return Capacitor.isNativePlatform()
}
