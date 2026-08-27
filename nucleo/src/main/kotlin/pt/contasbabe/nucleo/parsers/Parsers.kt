package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta

/** Registo dos parsers. O listener não conhece nenhum deles — só isto. */
object Parsers {

    val TODOS: List<Parser> = listOf(WalletParser, MbWayParser, SantanderParser)

    /**
     * Um pacote pertence a um parser só, por isso o primeiro que [Parser.aceita]
     * decide sozinho: se ele devolver `null`, a notificação não é despesa, e não
     * se tenta outro à sorte.
     */
    fun parse(n: NotificacaoBruta): Captura? =
        TODOS.firstOrNull { it.aceita(n.pacote) }?.parse(n)
}
