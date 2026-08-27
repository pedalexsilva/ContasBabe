package pt.contasbabe.nucleo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

private const val DIA = 24L * 60 * 60 * 1000
private const val INICIO = 1_700_000_000_000L
private const val FIM = INICIO + 7 * DIA

class EventosTest {

    private fun evento(
        id: String = "e1",
        nome: String = "Açores",
        inicioMs: Long = INICIO,
        fimMs: Long = FIM,
        fechado: Boolean = false,
    ) = JanelaEvento(id, nome, inicioMs, fimMs, fechado)

    @Test
    fun `esta ativo a meio da viagem`() {
        assertTrue(estaAtivo(evento(), INICIO + 3 * DIA))
    }

    @Test
    fun `esta ativo nos limites da janela`() {
        assertTrue(estaAtivo(evento(), INICIO))
        assertTrue(estaAtivo(evento(), FIM))
    }

    @Test
    fun `nao esta ativo antes de comecar`() {
        assertFalse(estaAtivo(evento(), INICIO - 1))
    }

    @Test
    fun `continua ativo dentro da tolerancia pos-fim`() {
        // O reembolso do hotel chega dois dias depois de aterrares.
        assertTrue(estaAtivo(evento(), FIM + 2 * DIA))
        assertTrue(estaAtivo(evento(), FIM + TOLERANCIA_POS_FIM_MS))
    }

    @Test
    fun `deixa de estar ativo passada a tolerancia`() {
        assertFalse(estaAtivo(evento(), FIM + TOLERANCIA_POS_FIM_MS + 1))
    }

    @Test
    fun `fechado nunca esta ativo, nem a meio da viagem`() {
        assertFalse(estaAtivo(evento(fechado = true), INICIO + 3 * DIA))
    }

    @Test
    fun `ativos filtra a lista`() {
        val emCurso = evento(id = "curso")
        val antigo = evento(id = "antigo", inicioMs = INICIO - 60 * DIA, fimMs = INICIO - 50 * DIA)
        val futuro = evento(id = "futuro", inicioMs = INICIO + 60 * DIA, fimMs = INICIO + 67 * DIA)
        val arrumado = evento(id = "arrumado", fechado = true)

        assertEquals(
            listOf("curso"),
            ativos(listOf(emCurso, antigo, futuro, arrumado), INICIO + DIA).map { it.id },
        )
    }

    @Test
    fun `ativos devolve lista vazia quando nao ha nada a decorrer`() {
        assertEquals(emptyList(), ativos(listOf(evento()), FIM + 60 * DIA))
    }
}
