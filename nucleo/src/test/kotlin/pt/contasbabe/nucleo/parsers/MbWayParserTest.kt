package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MbWayParserTest {

    private fun notificacao(texto: String, titulo: String = "Compra QRCode") =
        NotificacaoBruta(MbWayParser.PACOTE, titulo, texto, recebidaEmMs = 1_700_000_000_000)

    private fun parse(texto: String, titulo: String = "Compra QRCode") =
        MbWayParser.parse(notificacao(texto, titulo))

    @Test
    fun `extrai comerciante e valor do texto real`() {
        val n = notificacao("Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.")

        assertEquals(
            Captura(
                valorCent = 95,
                comerciante = "CAFE ORFEU",
                cartaoLast4 = null,
                origem = Origem.MBWAY,
                rawText = n.textoCompleto,
            ),
            MbWayParser.parse(n),
        )
    }

    @Test
    fun `nao corta o comerciante na primeira virgula`() {
        // A âncora é `, no valor de`, não `,` — senão "LDA" ficava de fora.
        val c = parse("Compra QR Code no comerciante CAFE ORFEU, LDA, no valor de 0.95€, efetuada.")

        assertEquals("CAFE ORFEU, LDA", c?.comerciante)
        assertEquals(95, c?.valorCent)
    }

    @Test
    fun `le valores com separador de milhares`() {
        val c = parse("Compra QR Code no comerciante HOTEL RIBAMAR, no valor de 1,234.56€, efetuada.")

        assertEquals(123456, c?.valorCent)
        assertEquals("HOTEL RIBAMAR", c?.comerciante)
    }

    @Test
    fun `limpa espacos a mais no nome do comerciante`() {
        val c = parse("Compra QR Code no comerciante  CAFE   ORFEU , no valor de 0.95€, efetuada.")

        assertEquals("CAFE ORFEU", c?.comerciante)
    }

    @Test
    fun `nunca da last4 — o MB Way nao o traz`() {
        assertNull(parse("Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.")?.cartaoLast4)
    }

    @Test
    fun `ignora transferencia entre pessoas`() {
        // Fase 3: passa a acerto de contas. Até lá, não é despesa nenhuma.
        assertNull(
            parse(
                texto = "Recebeu 10.00€ de Ana Silva.",
                titulo = "Transferência MB WAY",
            ),
        )
    }

    @Test
    fun `ignora envio de dinheiro mesmo com a estrutura de compra`() {
        assertNull(
            parse(
                texto = "Enviou no comerciante ANA SILVA, no valor de 10.00€, efetuada.",
                titulo = "MB WAY",
            ),
        )
    }

    @Test
    fun `ignora promocional com numero mas sem a estrutura`() {
        assertNull(parse(texto = "Ganhe 50 € em compras!", titulo = "MB WAY"))
    }

    @Test
    fun `ignora texto com comerciante mas sem valor`() {
        assertNull(parse("Compra QR Code no comerciante CAFE ORFEU cancelada."))
    }

    @Test
    fun `so aceita o pacote do MB Way`() {
        assertTrue(MbWayParser.aceita(MbWayParser.PACOTE))
        assertFalse(MbWayParser.aceita(SantanderParser.PACOTE))
        assertFalse(MbWayParser.aceita("com.whatsapp"))
    }
}
