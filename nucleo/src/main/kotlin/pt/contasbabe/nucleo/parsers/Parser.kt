package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import java.text.Normalizer

interface Parser {
    val origem: Origem

    /** O package que este parser reconhece. O ecrã de debug lista-os a partir daqui. */
    val pacote: String

    /** O único sítio que precisa de mudar quando o corpus da Fase 0 confirmar os packages. */
    fun aceita(pacote: String): Boolean

    /** `null` = "isto não é uma despesa". Nunca adivinhar. */
    fun parse(n: NotificacaoBruta): Captura?
}

private val ESPACOS = Regex("[\\u00A0\\u202F\\u2009\\u2007\\u2008\\u2060\\s]+")

private val ACENTOS = Regex("\\p{Mn}+")

/**
 * Todos os espaços invisíveis das apps de bancos viram um espaço simples, para
 * que um `\s` numa regex de parser não falhe em silêncio.
 */
internal fun normalizarEspacos(texto: String): String = ESPACOS.replace(texto, " ").trim()

/**
 * Minúsculas e sem acentos, para os filtros de palavras-chave: só assim
 * `autorização` bate com `autorizacao` e `transferência` com `transferencia`.
 */
internal fun normalizar(texto: String): String =
    ACENTOS.replace(Normalizer.normalize(texto, Normalizer.Form.NFD), "").lowercase()
