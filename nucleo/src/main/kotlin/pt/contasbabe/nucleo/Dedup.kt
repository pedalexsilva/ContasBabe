package pt.contasbabe.nucleo

import kotlin.math.abs

/** O que já está gravado, reduzido ao que a decisão precisa de ver. */
data class DespesaExistente(
    val id: String,
    val valorCent: Int,
    val pagouId: String,
    val ocorreuEmMs: Long,
    val origem: Origem,
    val cartaoLast4: String?,
    /**
     * `pendente`, `confirmada` ou `descartada`. A decisão não o usa, mas quem
     * enriquece precisa dele: republicar a notificação de confirmação de uma
     * despesa já confirmada ou descartada põe-na outra vez à frente de quem
     * acabou de a despachar.
     */
    val estado: String = "pendente",
    /**
     * O texto original já gravado. Também não entra na decisão: serve para quem
     * enriquece poder juntar os dois textos do par em vez de deitar um fora.
     */
    val rawText: String? = null,
)

sealed interface Decisao {
    data object Criar : Decisao

    /** A nova é redundante. `last4APreencher` != null quando o par não tinha last4 e a nova traz. */
    data class Descartar(val parId: String, val last4APreencher: String?) : Decisao

    /** O par é do Santander e a nova traz comerciante: atualiza o existente. */
    data class Enriquecer(val parId: String) : Decisao
}

/** Mediram-se 45 s entre o MB Way e o Santander. Três minutos dão margem para redes más. */
const val JANELA_MS: Long = 3 * 60 * 1000

/**
 * Decide o que fazer com uma captura nova, dadas as despesas já gravadas na
 * vizinhança temporal. Função pura: quem chama é que fala com o Firestore.
 *
 * **O chamador tem de incluir em [candidatas] as despesas com estado
 * `descartada`.** Descartar não apaga o documento justamente por isto: se
 * descartares a captura do MB Way e o Santander chegar 45 segundos depois, o par
 * tem de continuar a existir — senão o Santander renasce como despesa zombie.
 *
 * O desempate é sempre o mesmo: **na dúvida, criar**. Um duplicado vê-se e
 * apaga-se num toque; uma despesa engolida aqui nunca mais aparece.
 */
fun decidir(
    nova: Captura,
    pagouId: String,
    ocorreuEmMs: Long,
    candidatas: List<DespesaExistente>,
    janelaMs: Long = JANELA_MS,
): Decisao {
    val par = candidatas
        .filter {
            it.valorCent == nova.valorCent &&
                it.pagouId == pagouId &&
                abs(ocorreuEmMs - it.ocorreuEmMs) <= janelaMs
        }
        .minByOrNull { abs(ocorreuEmMs - it.ocorreuEmMs) }
        ?: return Decisao.Criar

    return when {
        // Qualquer par que não seja Santander ganha ao Santander — incluindo um
        // registo manual. Se acabaste de escrever o café à mão, a notificação
        // que chega 40 segundos depois é a mesma compra, não outra.
        nova.origem == Origem.SANTANDER && par.origem != Origem.SANTANDER ->
            Decisao.Descartar(par.id, if (par.cartaoLast4 == null) nova.cartaoLast4 else null)

        // O par não traz comerciante (Santander ou manual) e a nova traz: o
        // comerciante é um ganho, e criar outra despesa seria duplicá-la.
        nova.origem.primaria && !par.origem.primaria ->
            Decisao.Enriquecer(par.id)

        // Duas primárias, ou dois Santander: são duas compras reais iguais em
        // rondas seguidas. Os reposts da mesma notificação já morreram no filtro
        // do listener, por isso chegar aqui duas vezes significa mesmo duas vezes.
        else -> Decisao.Criar
    }
}
