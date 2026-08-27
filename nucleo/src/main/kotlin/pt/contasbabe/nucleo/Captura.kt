package pt.contasbabe.nucleo

/**
 * De onde veio a captura.
 *
 * [primaria] marca as origens que trazem informação de compra a sério
 * (comerciante, ou pelo menos a confirmação de que a compra aconteceu). O
 * Santander é rede de segurança: chega sempre, mas sem comerciante, e por isso
 * perde para uma primária na deduplicação.
 */
enum class Origem(val chave: String, val primaria: Boolean) {
    WALLET("wallet", true),
    MBWAY("mbway", true),
    SANTANDER("santander", false),
    MANUAL("manual", false);

    companion object {
        fun de(chave: String): Origem? = entries.firstOrNull { it.chave == chave }
    }
}

/**
 * O que um parser conseguiu extrair de uma notificação.
 *
 * [rawText] guarda-se sempre: quando o banco mudar uma palavra do texto, é o
 * corpus que permite reparar o parser sem voltar a viver uma semana.
 */
data class Captura(
    val valorCent: Int,
    val comerciante: String?,
    val cartaoLast4: String?,
    val origem: Origem,
    val rawText: String,
)
