package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem

/**
 * Stub deliberado: [parse] devolve sempre `null`.
 *
 * O texto real das notificações da Google Wallet ainda não foi recolhido, e a
 * regra do projeto é que **nenhum parser se escreve sem um teste com o texto
 * real como fixture**. Uma regex inventada aqui não falharia nos testes — só em
 * produção, em silêncio, e a captura em silêncio é o modo de falha que este
 * módulo existe para evitar.
 *
 * Quando o corpus da Fase 0 chegar:
 * 1. Confirmar [PACOTE] com o `packageName` registado pelo coletor.
 * 2. Colar os textos reais como fixtures no `WalletParserTest` — incluindo os
 *    reembolsos de valor negativo que já se viram no histórico.
 * 3. Escrever a regex contra esses fixtures, exigindo a estrutura completa
 *    (como no [SantanderParser]), nunca só um número.
 */
object WalletParser : Parser {

    /**
     * TEM de ser confirmado com o corpus da Fase 0 — nenhuma fonte externa vale
     * um `packageName` real. [aceita] é o único sítio a mudar quando o for.
     */
    const val PACOTE = "com.google.android.apps.walletnfcrel"

    override val origem = Origem.WALLET

    override fun aceita(pacote: String) = pacote == PACOTE

    override fun parse(n: NotificacaoBruta): Captura? = null
}
