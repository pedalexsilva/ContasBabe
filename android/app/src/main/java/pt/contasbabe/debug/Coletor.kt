package pt.contasbabe.debug

import android.content.Context
import android.util.Log
import org.json.JSONObject
import pt.contasbabe.nucleo.NotificacaoBruta
import java.io.File

/**
 * Fase 0: regista tudo o que passa pelo listener, num ficheiro.
 *
 * Instala-se, vive-se uma semana normal, e no fim há os textos reais de todas
 * as origens — incluindo casos que ninguém previu e, sobretudo, os nomes de
 * pacote certos. Nenhum parser se escreve antes disto: uma regex escrita de cor
 * contra um formato imaginado falha em silêncio no primeiro café.
 *
 * Fica ligado depois da Fase 0 de propósito. Quando o Santander mudar uma
 * palavra, é aqui que está o texto novo para reparar o parser.
 */
object Coletor {

    private const val FICHEIRO = "corpus-notificacoes.jsonl"

    /** Acima disto, o ficheiro é cortado ao meio. Uma semana normal não chega perto. */
    private const val MAXIMO_BYTES = 2 * 1024 * 1024

    @Synchronized
    fun registar(ctx: Context, bruta: NotificacaoBruta) {
        try {
            val ficheiro = ficheiro(ctx)
            if (ficheiro.length() > MAXIMO_BYTES) cortarMetade(ficheiro)

            val linha = JSONObject()
                .put("pacote", bruta.pacote)
                .put("titulo", bruta.titulo)
                .put("texto", bruta.texto)
                .put("recebidaEmMs", bruta.recebidaEmMs)
                .toString()

            ficheiro.appendText("$linha\n")
        } catch (e: Exception) {
            // O coletor nunca pode ser a razão de uma captura falhar.
            Log.w("ContasBabe", "coletor: falha a registar", e)
        }
    }

    fun ficheiro(ctx: Context): File = File(ctx.filesDir, FICHEIRO)

    fun tamanho(ctx: Context): Long = ficheiro(ctx).length()

    fun linhas(ctx: Context): Int {
        val f = ficheiro(ctx)
        if (!f.exists()) return 0
        return f.useLines { it.count() }
    }

    fun limpar(ctx: Context) {
        ficheiro(ctx).delete()
    }

    /** Deita fora a metade mais antiga: os textos recentes são os que interessam. */
    private fun cortarMetade(ficheiro: File) {
        val todas = ficheiro.readLines()
        ficheiro.writeText(todas.drop(todas.size / 2).joinToString("\n", postfix = "\n"))
    }
}
