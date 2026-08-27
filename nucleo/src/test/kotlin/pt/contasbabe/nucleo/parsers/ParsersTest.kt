package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class ParsersTest {

    private fun notificacao(pacote: String, titulo: String, texto: String) =
        NotificacaoBruta(pacote, titulo, texto, recebidaEmMs = 1_700_000_000_000)

    @Test
    fun `encaminha para o parser do Santander`() {
        val c = Parsers.parse(
            notificacao(
                SantanderParser.PACOTE,
                "Santander",
                "Movimento no valor de EUR 0,95 no cartão ***********0390",
            ),
        )

        assertEquals(Origem.SANTANDER, c?.origem)
        assertEquals(95, c?.valorCent)
    }

    @Test
    fun `encaminha para o parser do MB Way`() {
        val c = Parsers.parse(
            notificacao(
                MbWayParser.PACOTE,
                "Compra QRCode",
                "Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.",
            ),
        )

        assertEquals(Origem.MBWAY, c?.origem)
        assertEquals("CAFE ORFEU", c?.comerciante)
    }

    @Test
    fun `devolve null quando nenhum parser aceita o pacote`() {
        assertNull(
            Parsers.parse(
                notificacao("com.whatsapp", "Ana", "Movimento no valor de EUR 0,95 no cartão ***********0390"),
            ),
        )
    }

    @Test
    fun `nao tenta outro parser quando o dono do pacote recusa`() {
        // O texto do Santander num pacote da Wallet não vira captura: o
        // WalletParser aceita o pacote e devolve `null`, e fica por aí.
        assertNull(
            Parsers.parse(
                notificacao(
                    WalletParser.PACOTE,
                    "Santander",
                    "Movimento no valor de EUR 0,95 no cartão ***********0390",
                ),
            ),
        )
    }

    @Test
    fun `o registo tem uma origem distinta por parser`() {
        assertEquals(Parsers.TODOS.size, Parsers.TODOS.map { it.origem }.distinct().size)
    }
}
