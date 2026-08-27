package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

private const val NBSP = " "

class SantanderParserTest {

    private fun notificacao(texto: String, titulo: String = "Santander") =
        NotificacaoBruta(SantanderParser.PACOTE, titulo, texto, recebidaEmMs = 1_700_000_000_000)

    private fun parse(texto: String, titulo: String = "Santander") =
        SantanderParser.parse(notificacao(texto, titulo))

    @Test
    fun `extrai valor e last4 do texto real`() {
        val n = notificacao("Movimento no valor de EUR 0,95 no cartão ***********0390")

        assertEquals(
            Captura(
                valorCent = 95,
                comerciante = null,
                cartaoLast4 = "0390",
                origem = Origem.SANTANDER,
                rawText = n.textoCompleto,
            ),
            SantanderParser.parse(n),
        )
    }

    @Test
    fun `le valores com separador de milhares`() {
        val c = parse("Movimento no valor de EUR 1.234,56 no cartão ***********0390")

        assertEquals(123456, c?.valorCent)
        assertEquals("0390", c?.cartaoLast4)
    }

    @Test
    fun `sobrevive a espacos invisiveis no corpo`() {
        val c = parse("Movimento no valor de EUR${NBSP}0,95${NBSP}no cartão ***********0390")

        assertEquals(95, c?.valorCent)
        assertEquals("0390", c?.cartaoLast4)
    }

    @Test
    fun `nunca da comerciante — o Santander nao o traz`() {
        assertNull(parse("Movimento no valor de EUR 12,50 no cartão ***********0390")?.comerciante)
    }

    @Test
    fun `descarta pedido de autorizacao com acento`() {
        assertNull(parse("Autorização de compra no valor de EUR 25,00 no cartão ***********0390"))
    }

    @Test
    fun `descarta pedido para autorizar`() {
        assertNull(parse("Para autorizar a compra no valor de EUR 25,00 no cartão ***********0390, abra a app"))
    }

    @Test
    fun `descarta pedido para confirmar`() {
        assertNull(parse("Confirmar compra no valor de EUR 25,00 no cartão ***********0390"))
    }

    @Test
    fun `descarta codigo 3D Secure`() {
        assertNull(
            parse("O seu código 3D Secure para a compra no valor de EUR 25,00 no cartão ***********0390 é 481922"),
        )
    }

    @Test
    fun `descarta aviso de operacao nao reconhecida`() {
        assertNull(
            parse("Se não reconhece a operação no valor de EUR 25,00 no cartão ***********0390, contacte-nos"),
        )
    }

    @Test
    fun `descarta 3D Secure anunciado so no titulo`() {
        assertNull(
            parse(
                texto = "Movimento no valor de EUR 25,00 no cartão ***********0390",
                titulo = "Autorização de compra",
            ),
        )
    }

    @Test
    fun `ignora promocional com numero mas sem a estrutura`() {
        assertNull(parse("Ganhe 50 € em compras!"))
    }

    @Test
    fun `ignora texto com valor mas sem cartao`() {
        // Metade da estrutura não chega: é isto que trava os falsos positivos.
        assertNull(parse("Poupança no valor de EUR 50,00 disponível"))
    }

    @Test
    fun `ignora texto com cartao mas sem valor`() {
        assertNull(parse("O seu cartão ***********0390 foi ativado"))
    }

    @Test
    fun `so aceita o pacote do Santander`() {
        assertTrue(SantanderParser.aceita(SantanderParser.PACOTE))
        assertFalse(SantanderParser.aceita(MbWayParser.PACOTE))
        assertFalse(SantanderParser.aceita("com.whatsapp"))
    }
}
