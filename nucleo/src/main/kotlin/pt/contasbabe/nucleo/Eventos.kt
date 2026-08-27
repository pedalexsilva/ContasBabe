package pt.contasbabe.nucleo

/** Reembolsos, cauções e acertos de pré-autorização chegam depois de a viagem acabar. */
const val TOLERANCIA_POS_FIM_MS: Long = 3L * 24 * 60 * 60 * 1000

data class JanelaEvento(
    val id: String,
    val nome: String,
    val inicioMs: Long,
    val fimMs: Long,
    val fechado: Boolean,
)

fun estaAtivo(e: JanelaEvento, agoraMs: Long): Boolean =
    !e.fechado && agoraMs >= e.inicioMs && agoraMs <= e.fimMs + TOLERANCIA_POS_FIM_MS

fun ativos(eventos: List<JanelaEvento>, agoraMs: Long): List<JanelaEvento> =
    eventos.filter { estaAtivo(it, agoraMs) }
