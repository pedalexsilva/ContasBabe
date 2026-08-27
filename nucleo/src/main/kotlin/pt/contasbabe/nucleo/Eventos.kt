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

/**
 * Eventos cuja janela contém a data da despesa — a sugestão da caixa "Por tratar".
 *
 * Aqui não há tolerância nem se olha para [JanelaEvento.fechado]: uma despesa
 * antiga que só agora se está a tratar tem de continuar a sugerir o evento a que
 * pertence, mesmo que a viagem já tenha fechado.
 */
fun sugeridos(eventos: List<JanelaEvento>, ocorreuEmMs: Long): List<JanelaEvento> =
    eventos.filter { ocorreuEmMs >= it.inicioMs && ocorreuEmMs <= it.fimMs }
