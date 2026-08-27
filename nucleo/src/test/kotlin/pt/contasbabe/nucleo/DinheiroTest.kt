package pt.contasbabe.nucleo

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Espelho de `src/dominio/dinheiro.test.ts`. Se um caso mudar aqui, tem de mudar lá.
 *
 * Os espaços invisíveis aparecem como escapes `\u` de propósito: colados como
 * caracteres reais, um `git diff` ou uma revisão nunca os veriam.
 */
private const val NBSP = "\u00A0"
private const val NARROW = "\u202F"
private const val THIN = "\u2009"

class DinheiroTest {

    @Test
    fun `aceita a virgula decimal do Santander`() {
        assertEquals(95, parseCent("0,95"))
        assertEquals(95, parseCent("EUR 0,95"))
        assertEquals(1250, parseCent("12,50"))
    }

    @Test
    fun `aceita o ponto decimal do MB Way`() {
        assertEquals(95, parseCent("0.95"))
        assertEquals(95, parseCent("0.95€"))
        assertEquals(1250, parseCent("12.50"))
    }

    @Test
    fun `aceita o simbolo antes ou depois, com ou sem espaco`() {
        assertEquals(320, parseCent("€ 3,20"))
        assertEquals(320, parseCent("3,20 €"))
        assertEquals(320, parseCent("EUR3,20"))
    }

    @Test
    fun `aceita a moeda por extenso, no singular e no plural`() {
        assertEquals(320, parseCent("3,20 eur"))
        assertEquals(100, parseCent("1,00 euro"))
        assertEquals(320, parseCent("3,20 euros"))
        assertEquals(320, parseCent("3,20 EUROS"))
    }

    @Test
    fun `trata 1_234,56 como mil duzentos e trinta e quatro euros e 56`() {
        assertEquals(123456, parseCent("1.234,56"))
    }

    @Test
    fun `trata 1,234_56 (formato ingles) da mesma maneira`() {
        assertEquals(123456, parseCent("1,234.56"))
    }

    @Test
    fun `trata um separador so, seguido de tres digitos, como milhares`() {
        // Dinheiro tem duas casas decimais. `1.234` nunca é um euro e 234.
        assertEquals(123400, parseCent("1.234"))
        assertEquals(123400, parseCent("1,234"))
    }

    @Test
    fun `aceita mais do que um grupo de milhares`() {
        assertEquals(123456789, parseCent("1.234.567,89"))
    }

    @Test
    fun `nao confunde duas casas decimais com milhares`() {
        assertEquals(150, parseCent("1,50"))
        assertEquals(150, parseCent("1.50"))
    }

    @Test
    fun `sobrevive a non-breaking space entre valor e simbolo`() {
        assertEquals(95, parseCent("0,95${NBSP}€"))
    }

    @Test
    fun `sobrevive a narrow no-break space, que a Wallet usa`() {
        assertEquals(123456, parseCent("1${NARROW}234,56${NARROW}€"))
    }

    @Test
    fun `sobrevive a thin space como separador de milhares`() {
        assertEquals(123456, parseCent("1${THIN}234,56"))
    }

    @Test
    fun `aceita o sinal negativo dos reembolsos`() {
        assertEquals(-1250, parseCent("-12,50"))
        assertEquals(-1250, parseCent("-EUR 12,50"))
    }

    @Test
    fun `aceita o sinal menos tipografico`() {
        assertEquals(-1250, parseCent("−12,50"))
    }

    @Test
    fun `aceita um mais explicito`() {
        assertEquals(1250, parseCent("+12,50"))
    }

    @Test
    fun `recusa texto vazio, nulo ou so moeda`() {
        assertNull(parseCent(""))
        assertNull(parseCent(null))
        assertNull(parseCent("EUR"))
        assertNull(parseCent("   "))
        assertNull(parseCent(NBSP))
    }

    @Test
    fun `recusa mais de duas casas decimais`() {
        assertNull(parseCent("1,2345"))
    }

    @Test
    fun `recusa grupos de milhares mal formados`() {
        assertNull(parseCent("1.23,45"))
        assertNull(parseCent("12.3456,78"))
    }

    @Test
    fun `recusa separadores pendurados`() {
        assertNull(parseCent("1,"))
        assertNull(parseCent(",95"))
        assertNull(parseCent("1,,95"))
    }

    @Test
    fun `recusa qualquer coisa com letras pelo meio`() {
        assertNull(parseCent("12 meses"))
        assertNull(parseCent("50%"))
    }

    @Test
    fun `aceita euros redondos sem casas decimais`() {
        assertEquals(1200, parseCent("12"))
        assertEquals(1200, parseCent("12€"))
    }

    @Test
    fun `recusa valores que nao cabem num Int em vez de dar a volta`() {
        assertNull(parseCent("99.999.999.999,99"))
        assertNull(parseCent("21474836,48"))
        assertEquals(2147483647, parseCent("21474836,47"))
    }

    @Test
    fun `aceita o reembolso que calha exatamente em Int MIN_VALUE`() {
        // O sinal tem de entrar antes da verificação de alcance: em módulo este
        // valor passa o Int.MAX por um cêntimo, mas em negativo é representável.
        assertEquals(Int.MIN_VALUE, parseCent("-21474836,48"))
        assertNull(parseCent("-21474836,49"))
    }
}

class FormatarCentTest {

    @Test
    fun `formata em portugues, com ponto nos milhares e virgula decimal`() {
        assertEquals("0,00 €", formatarCent(0))
        assertEquals("0,05 €", formatarCent(5))
        assertEquals("0,95 €", formatarCent(95))
        assertEquals("12,50 €", formatarCent(1250))
        assertEquals("1.234,56 €", formatarCent(123456))
        assertEquals("1.234.567,89 €", formatarCent(123456789))
        assertEquals("-12,50 €", formatarCent(-1250))
    }

    @Test
    fun `da a mesma resposta que o gemeo em TypeScript`() {
        // Os mesmos valores estão em src/dominio/dinheiro.test.ts. Se um lado
        // mudar sem o outro, a app mostra um valor na notificação e outro no ecrã.
        for (cent in listOf(0, 1, 95, 1250, 123456, 123456789)) {
            assertEquals(cent, parseCent(formatarCent(cent)))
        }
        assertEquals(-1250, parseCent(formatarCent(-1250)))
    }

    @Test
    fun `aguenta os extremos do Int sem rebentar`() {
        assertEquals("21.474.836,47 €", formatarCent(Int.MAX_VALUE))
        assertEquals("-21.474.836,48 €", formatarCent(Int.MIN_VALUE))
    }
}
