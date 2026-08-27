package pt.contasbabe.nucleo

/**
 * Dinheiro em cêntimos inteiros. Nunca float — nem aqui, nem no schema.
 *
 * Porto fiel de `src/dominio/dinheiro.ts`: as duas implementações partilham a
 * mesma bateria de casos, e se uma regra mudar num lado tem de mudar no outro
 * e nos dois testes.
 */

/**
 * Espaços que as apps de bancos usam e que são invisíveis num log: NBSP,
 * narrow NBSP, thin space, figure space, punctuation space e word joiner.
 *
 * Escritos como escapes `\u` de propósito. Em JavaScript o `\s` já apanha estes
 * todos; na JVM `\s` é só ASCII, por isso aqui a lista tem mesmo de ser
 * explícita — sem ela, `1 234,56` com narrow space falha sem explicação.
 */
private val ESPACOS = Regex("[\\u00A0\\u202F\\u2009\\u2007\\u2008\\u2060\\s]+")

/**
 * Símbolos e códigos de moeda que aparecem colados ao valor.
 *
 * A ordem das alternativas conta: `eur(?:o|os)?` deixaria o `s` de "euros"
 * pendurado, porque o `o` casa primeiro e o `os` nunca chega a ser tentado.
 */
private val MOEDA = Regex("eur(?:os?)?|€", RegexOption.IGNORE_CASE)

private val SO_DIGITOS_E_SEPARADORES = Regex("^\\d[\\d.,]*$")

private val SEPARADORES = Regex("[.,]")

/**
 * Acima disto `euros * 100` nem em Long cabe, e a verificação de overflow do
 * Int chegaria tarde de mais — já com o valor às voltas.
 *
 * Divergência assumida face ao TypeScript: lá o limite é `Number.isSafeInteger`
 * (2^53), aqui é o Int. Valores acima de ~21 M€ dão `null` em Kotlin e número em
 * JS. Nenhuma notificação de compra chega perto, e `null` é o lado seguro.
 */
private const val MAX_EUROS: Long = Int.MAX_VALUE / 100L

/**
 * Converte um valor monetário em texto para cêntimos inteiros.
 *
 * Aceita `0,95`, `0.95`, `EUR 0,95`, `0.95€`, `1.234,56`, `1,234.56`, `-12,50`.
 * Devolve `null` para tudo o que não seja inequivocamente um valor monetário —
 * na captura de notificações, `null` significa "não é uma despesa", e é essa
 * severidade que trava os falsos positivos.
 */
fun parseCent(texto: String?): Int? {
    if (texto == null) return null

    var s = MOEDA.replace(texto, "").replace(ESPACOS, "")
    if (s.isEmpty()) return null

    var sinal = 1
    if (s.startsWith('-') || s.startsWith('−')) {
        sinal = -1
        s = s.substring(1)
    } else if (s.startsWith('+')) {
        s = s.substring(1)
    }

    if (!SO_DIGITOS_E_SEPARADORES.matches(s)) return null

    val grupos = s.split(SEPARADORES)
    if (grupos.any { it.isEmpty() }) return null

    val euros: String
    val centesimos: String

    if (grupos.size == 1) {
        euros = grupos[0]
        centesimos = "00"
    } else {
        val ultimo = grupos.last()

        // Regra que desfaz a ambiguidade de `1.234`: dinheiro tem no máximo duas
        // casas decimais, logo um separador seguido de exatamente três dígitos é
        // sempre separador de milhares. Uma ou duas casas → é o decimal.
        if (ultimo.length == 3) {
            euros = grupos.joinToString("")
            centesimos = "00"
        } else if (ultimo.length == 1 || ultimo.length == 2) {
            euros = grupos.dropLast(1).joinToString("")
            centesimos = ultimo.padEnd(2, '0')
        } else {
            return null
        }

        // Todos os separadores antes do decimal têm de delimitar grupos de três.
        val milhares = if (ultimo.length == 3) grupos else grupos.dropLast(1)
        for (i in 1 until milhares.size) {
            if (milhares[i].length != 3) return null
        }
        if (milhares.size > 1 && (milhares[0].isEmpty() || milhares[0].length > 3)) {
            return null
        }
    }

    val valorEuros = euros.toLongOrNull() ?: return null
    if (valorEuros > MAX_EUROS) return null

    // O sinal aplica-se antes de verificar o alcance: `Int.MIN_VALUE` é um
    // cêntimo mais fundo do que `Int.MAX_VALUE` é alto, e o reembolso que calha
    // lá é válido.
    val cent = sinal * (valorEuros * 100 + centesimos.toLong())
    if (cent !in Int.MIN_VALUE.toLong()..Int.MAX_VALUE.toLong()) return null

    return cent.toInt()
}
