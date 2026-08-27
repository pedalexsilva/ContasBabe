package pt.contasbabe.nucleo

import kotlin.test.Test
import kotlin.test.assertEquals

private const val AGORA = 1_700_000_000_000L
private const val EU = "eu"
private const val ELA = "ela"

class DedupTest {

    private fun captura(origem: Origem, valorCent: Int = 95, last4: String? = null, comerciante: String? = null) =
        Captura(valorCent, comerciante, last4, origem, rawText = "…")

    private fun existente(
        id: String,
        origem: Origem,
        valorCent: Int = 95,
        pagouId: String = EU,
        ocorreuEmMs: Long = AGORA,
        last4: String? = null,
        estado: String = "pendente",
    ) = DespesaExistente(id, valorCent, pagouId, ocorreuEmMs, origem, last4, estado)

    @Test
    fun `sem candidatas cria`() {
        assertEquals(
            Decisao.Criar,
            decidir(captura(Origem.MBWAY), EU, AGORA, emptyList()),
        )
    }

    @Test
    fun `Santander com par primario descarta e aproveita o last4`() {
        assertEquals(
            Decisao.Descartar("d1", "0390"),
            decidir(
                nova = captura(Origem.SANTANDER, last4 = "0390"),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY, ocorreuEmMs = AGORA - 45_000)),
            ),
        )
    }

    @Test
    fun `Santander com par primario que ja tem last4 nao o reescreve`() {
        assertEquals(
            Decisao.Descartar("d1", null),
            decidir(
                nova = captura(Origem.SANTANDER, last4 = "0390"),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.WALLET, last4 = "0390")),
            ),
        )
    }

    @Test
    fun `Santander sem last4 descarta na mesma`() {
        assertEquals(
            Decisao.Descartar("d1", null),
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.WALLET)),
            ),
        )
    }

    @Test
    fun `primaria com par do Santander enriquece o existente`() {
        assertEquals(
            Decisao.Enriquecer("d1"),
            decidir(
                nova = captura(Origem.MBWAY, comerciante = "CAFE ORFEU"),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.SANTANDER, ocorreuEmMs = AGORA - 45_000, last4 = "0390")),
            ),
        )
    }

    @Test
    fun `duas primarias criam — sao duas compras reais`() {
        // Dois cafés iguais em rondas seguidas. Os reposts já morreram no listener.
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.WALLET),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY)),
            ),
        )
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.MBWAY),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY)),
            ),
        )
    }

    @Test
    fun `dois Santander criam — pela mesma razao`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER, last4 = "0390"),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.SANTANDER, last4 = "0390")),
            ),
        )
    }

    @Test
    fun `uma captura descartada continua a servir de par`() {
        // O chamador tem de passar as descartadas. Sem isto, o Santander que
        // chega 45 s depois renasce como despesa zombie.
        val descartada = existente("d1", Origem.MBWAY, ocorreuEmMs = AGORA - 45_000)

        assertEquals(
            Decisao.Descartar("d1", "0390"),
            decidir(captura(Origem.SANTANDER, last4 = "0390"), EU, AGORA, listOf(descartada)),
        )
    }

    @Test
    fun `dentro da janela, ate ao limite, e par`() {
        assertEquals(
            Decisao.Enriquecer("d1"),
            decidir(
                nova = captura(Origem.MBWAY),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.SANTANDER, ocorreuEmMs = AGORA - JANELA_MS)),
            ),
        )
        assertEquals(
            Decisao.Enriquecer("d1"),
            decidir(
                nova = captura(Origem.MBWAY),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.SANTANDER, ocorreuEmMs = AGORA + JANELA_MS)),
            ),
        )
    }

    @Test
    fun `um segundo depois da janela ja cria`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY, ocorreuEmMs = AGORA - JANELA_MS - 1_000)),
            ),
        )
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY, ocorreuEmMs = AGORA + JANELA_MS + 1_000)),
            ),
        )
    }

    @Test
    fun `valor diferente nao e par`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER, valorCent = 95),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY, valorCent = 96)),
            ),
        )
    }

    @Test
    fun `pagador diferente nao e par`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY, pagouId = ELA)),
            ),
        )
    }

    @Test
    fun `com dois candidatos escolhe o mais proximo no tempo`() {
        val decisao = decidir(
            nova = captura(Origem.SANTANDER, last4 = "0390"),
            pagouId = EU,
            ocorreuEmMs = AGORA,
            candidatas = listOf(
                existente("longe", Origem.MBWAY, ocorreuEmMs = AGORA - 150_000),
                existente("perto", Origem.MBWAY, ocorreuEmMs = AGORA - 20_000),
            ),
        )

        assertEquals(Decisao.Descartar("perto", "0390"), decisao)
    }

    @Test
    fun `a janela e configuravel para os testes de fronteira`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY, ocorreuEmMs = AGORA - 30_000)),
                janelaMs = 10_000,
            ),
        )
    }

    @Test
    fun `uma captura manual nao e travada por uma automatica`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.MANUAL),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MBWAY)),
            ),
        )
    }

    @Test
    fun `o Santander nao duplica uma despesa que ja foi registada a mao`() {
        // "Na dúvida, criar" resolve dúvidas — e aqui não há nenhuma: acabaste
        // de dizer à app o que gastaste. O Santander dispara em TODAS as compras
        // com cartão, por isso a alternativa dava um duplicado garantido de cada
        // vez que alguém regista à mão uma compra que também pagou com cartão.
        assertEquals(
            Decisao.Descartar("d1", null),
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA,
                candidatas = listOf(existente("d1", Origem.MANUAL)),
            ),
        )
    }
}

class OrigemTest {

    @Test
    fun `converte a chave gravada de volta para o enum`() {
        assertEquals(Origem.WALLET, Origem.de("wallet"))
        assertEquals(Origem.MBWAY, Origem.de("mbway"))
        assertEquals(Origem.SANTANDER, Origem.de("santander"))
        assertEquals(Origem.MANUAL, Origem.de("manual"))
    }

    @Test
    fun `chave desconhecida da null em vez de rebentar`() {
        assertEquals(null, Origem.de("revolut"))
        assertEquals(null, Origem.de("WALLET"))
    }

    @Test
    fun `so a Wallet e o MB Way sao primarios`() {
        assertEquals(
            listOf(Origem.WALLET, Origem.MBWAY),
            Origem.entries.filter { it.primaria },
        )
    }
}

/**
 * O plano diz "nova é santander e existe par → descartar", sem qualificar o par.
 * Um registo manual é um par: se escreveste o café à mão, a notificação do
 * Santander 40 segundos depois é a mesma compra.
 */
class DedupComRegistoManualTest {

    private fun captura(origem: Origem, comerciante: String? = null, last4: String? = null) =
        Captura(95, comerciante, last4, origem, rawText = "…")

    private fun manual(id: String, ocorreuEmMs: Long = AGORA, estado: String = "confirmada") =
        DespesaExistente(id, 95, EU, ocorreuEmMs, Origem.MANUAL, null, estado)

    @Test
    fun `Santander com par manual descarta em vez de duplicar`() {
        assertEquals(
            Decisao.Descartar("m1", "0390"),
            decidir(
                nova = captura(Origem.SANTANDER, last4 = "0390"),
                pagouId = EU,
                ocorreuEmMs = AGORA + 40_000,
                candidatas = listOf(manual("m1")),
            ),
        )
    }

    @Test
    fun `primaria com par manual enriquece com o comerciante em vez de duplicar`() {
        assertEquals(
            Decisao.Enriquecer("m1"),
            decidir(
                nova = captura(Origem.MBWAY, comerciante = "CAFE ORFEU"),
                pagouId = EU,
                ocorreuEmMs = AGORA + 40_000,
                candidatas = listOf(manual("m1")),
            ),
        )
    }

    @Test
    fun `um manual fora da janela nao trava nada`() {
        assertEquals(
            Decisao.Criar,
            decidir(
                nova = captura(Origem.SANTANDER),
                pagouId = EU,
                ocorreuEmMs = AGORA + JANELA_MS + 1,
                candidatas = listOf(manual("m1")),
            ),
        )
    }

    @Test
    fun `o estado do par viaja na decisao, para quem enriquece saber se deve notificar`() {
        val descartada = manual("m1", estado = "descartada")
        assertEquals("descartada", descartada.estado)
        assertEquals(
            Decisao.Enriquecer("m1"),
            decidir(captura(Origem.MBWAY, comerciante = "X"), EU, AGORA, listOf(descartada)),
        )
    }
}
