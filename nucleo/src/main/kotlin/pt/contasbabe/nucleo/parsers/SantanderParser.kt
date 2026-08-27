package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import pt.contasbabe.nucleo.parseCent

/**
 * Rede de segurança: chega a todas as compras do cartão, mas sem comerciante.
 *
 * Fixture real (é a especificação deste parser):
 * ```
 * Título: Santander
 * Corpo:  Movimento no valor de EUR 0,95 no cartão ***********0390
 * ```
 */
object SantanderParser : Parser {

    /**
     * TEM de ser confirmado com o corpus da Fase 0 — nenhuma fonte externa vale
     * um `packageName` real. [aceita] é o único sítio a mudar quando o for.
     */
    const val PACOTE = "pt.santandertotta.mobileapp"

    /**
     * Exige a estrutura completa: valor **e** cartão mascarado. Um número solto
     * numa notificação promocional não chega para criar uma despesa.
     */
    private val MOVIMENTO = Regex(
        "no valor de\\s+EUR\\s*([\\d.,]+).*?cart[ãa]o\\s*\\*+(\\d{4})",
        setOf(RegexOption.IGNORE_CASE, RegexOption.DOT_MATCHES_ALL),
    )

    /**
     * 3D Secure: pedidos de autorização de uma compra que ainda **não**
     * aconteceu. Trazem valor e cartão na mesma, por isso não se distinguem pelo
     * formato — só pelo vocabulário.
     */
    private val PALAVRAS_3DS = listOf(
        "autorizar",
        "autorizacao",
        "confirmar",
        "codigo",
        "3d secure",
        "nao reconhece",
    )

    override val origem = Origem.SANTANDER

    override val pacote = PACOTE

    override fun aceita(pacote: String) = pacote == PACOTE

    override fun parse(n: NotificacaoBruta): Captura? {
        val normalizado = normalizar(n.textoCompleto)
        if (PALAVRAS_3DS.any { it in normalizado }) return null

        val m = MOVIMENTO.find(normalizarEspacos(n.texto)) ?: return null
        val valorCent = parseCent(m.groupValues[1]) ?: return null

        return Captura(
            valorCent = valorCent,
            comerciante = null,
            cartaoLast4 = m.groupValues[2],
            origem = Origem.SANTANDER,
            rawText = n.textoCompleto,
        )
    }
}
