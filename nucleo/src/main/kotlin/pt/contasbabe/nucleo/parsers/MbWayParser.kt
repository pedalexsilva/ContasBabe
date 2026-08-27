package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import pt.contasbabe.nucleo.parseCent

/**
 * Origem primária: é a única que traz o nome do comerciante.
 *
 * Fixture real (é a especificação deste parser):
 * ```
 * Título: Compra QRCode
 * Corpo:  Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.
 * ```
 */
object MbWayParser : Parser {

    /**
     * TEM de ser confirmado com o corpus da Fase 0 — nenhuma fonte externa vale
     * um `packageName` real. [aceita] é o único sítio a mudar quando o for.
     */
    const val PACOTE = "pt.sibs.android.mbway"

    /**
     * O comerciante fecha em `, no valor de` — a âncora completa, não a primeira
     * vírgula. Nomes com forma jurídica (`CAFE ORFEU, LDA`) trazem vírgulas
     * dentro, e um `[^,]+` cortava-os a meio.
     */
    private val COMPRA = Regex(
        "no comerciante\\s+(.+?),\\s*no valor de\\s*([\\d.,]+)\\s*€",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL),
    )

    /**
     * Transferências entre pessoas não são despesa — na Fase 3 passam a acerto
     * de contas. Até lá devolve-se `null` em vez de inventar uma compra.
     */
    private val PALAVRAS_TRANSFERENCIA = listOf(
        "transferencia",
        "enviou",
        "recebeu",
        "transferiu",
    )

    private val ESPACOS_INTERNOS = Regex("\\s+")

    override val origem = Origem.MBWAY

    override val pacote = PACOTE

    override fun aceita(pacote: String) = pacote == PACOTE

    override fun parse(n: NotificacaoBruta): Captura? {
        val normalizado = normalizar(n.textoCompleto)
        if (PALAVRAS_TRANSFERENCIA.any { it in normalizado }) return null

        val m = COMPRA.find(normalizarEspacos(n.texto)) ?: return null
        val valorCent = parseCent(m.groupValues[2]) ?: return null

        val comerciante = ESPACOS_INTERNOS.replace(m.groupValues[1], " ").trim()
        if (comerciante.isEmpty()) return null

        return Captura(
            valorCent = valorCent,
            comerciante = comerciante,
            cartaoLast4 = null,
            origem = Origem.MBWAY,
            rawText = n.textoCompleto,
        )
    }
}
