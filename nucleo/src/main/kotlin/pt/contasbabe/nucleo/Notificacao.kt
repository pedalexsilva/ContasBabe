package pt.contasbabe.nucleo

/**
 * A fronteira que torna os parsers testáveis: o listener converte o
 * StatusBarNotification nisto, e daqui para baixo já não há Android.
 */
data class NotificacaoBruta(
    val pacote: String,
    val titulo: String,
    val texto: String,
    val recebidaEmMs: Long,
) {
    /** Para os parsers que precisam de procurar nos dois — filtros e heurísticas. */
    val textoCompleto: String get() = "$titulo\n$texto"
}
