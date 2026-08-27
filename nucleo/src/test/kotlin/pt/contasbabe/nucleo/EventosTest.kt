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

    @Test
    fun `sugeridos apanha os eventos que contem a data da despesa`() {
        val acores = evento(id = "acores")
        val outro = evento(id = "outro", inicioMs = INICIO + 60 * DIA, fimMs = INICIO + 67 * DIA)

        assertEquals(
            listOf("acores"),
            sugeridos(listOf(acores, outro), INICIO + 3 * DIA).map { it.id },
        )
    }

    @Test
    fun `sugeridos sugere eventos ja fechados`() {
        // Uma despesa antiga tem de continuar a apontar para a viagem a que pertence.
        assertEquals(
            listOf("e1"),
            sugeridos(listOf(evento(fechado = true)), INICIO + 3 * DIA).map { it.id },
        )
    }

    @Test
    fun `sugeridos nao usa a tolerancia pos-fim`() {
        assertEquals(emptyList(), sugeridos(listOf(evento()), FIM + 1))
    }

    @Test
    fun `sugeridos pode devolver mais do que um evento sobreposto`() {
        val a = evento(id = "a")
        val b = evento(id = "b", inicioMs = INICIO + DIA, fimMs = FIM + DIA)

        assertEquals(
            listOf("a", "b"),
            sugeridos(listOf(a, b), INICIO + 3 * DIA).map { it.id },
        )
    }
}
