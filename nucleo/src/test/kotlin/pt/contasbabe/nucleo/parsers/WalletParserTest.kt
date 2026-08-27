package pt.contasbabe.nucleo.parsers

import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.Origem
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Este ficheiro é para **substituir**, não para apagar.
 *
 * Quando o corpus da Fase 0 trouxer os textos reais da Wallet, os fixtures
 * entram aqui e estes testes passam a afirmar valores. Até lá documentam o que
 * o parser faz de propósito: nada.
 */
class WalletParserTest {

    private fun notificacao(titulo: String, texto: String) =
        NotificacaoBruta(WalletParser.PACOTE, titulo, texto, recebidaEmMs = 1_700_000_000_000)

    @Test
    fun `nao captura nada enquanto nao houver texto real da Wallet`() {
        assertNull(WalletParser.parse(notificacao("Google Wallet", "0,95 € em CAFE ORFEU")))
        assertNull(WalletParser.parse(notificacao("Pagamento", "Pagaste 12,50 € com o cartão Santander")))
    }

    @Test
    fun `ja esta ligado ao pacote e a origem certos`() {
        assertTrue(WalletParser.aceita(WalletParser.PACOTE))
        assertFalse(WalletParser.aceita(MbWayParser.PACOTE))
        assertEquals(Origem.WALLET, WalletParser.origem)
    }
}
