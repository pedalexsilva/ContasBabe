package pt.contasbabe.debug

import android.app.Notification
import android.os.Bundle
import android.service.notification.StatusBarNotification
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File

/**
 * Fase 0: regista tudo o que passa pelo listener, num ficheiro.
 *
 * Instala-se, vive-se uma semana normal, e no fim há os textos reais de todas
 * as origens — incluindo casos que ninguém previu e, sobretudo, os nomes de
 * pacote certos. Nenhum parser se escreve antes disto: uma regex escrita de cor
 * contra um formato imaginado falha em silêncio no primeiro café.
 *
 * **Regista antes de qualquer filtro, e regista os extras todos.** As duas
 * coisas são deliberadas:
 *
 *  - se os resumos de grupo fossem filtrados antes, não haveria como verificar
 *    no corpus se esse filtro está a comer notificações legítimas;
 *  - muitas apps de bancos põem o conteúdo útil no `bigText` ou no `subText` e
 *    deixam o `EXTRA_TEXT` truncado com reticências. Guardar só um dos campos
 *    dava um corpus que parece completo e não é.
 *
 * Fica ligado depois da Fase 0 de propósito. Quando o Santander mudar uma
 * palavra, é aqui que está o texto novo para reparar o parser.
 */
object Coletor {

    private const val FICHEIRO = "corpus-notificacoes.jsonl"

    /** Acima disto, o ficheiro é cortado ao meio. Uma semana normal não chega perto. */
    private const val MAXIMO_BYTES = 2 * 1024 * 1024

    @Synchronized
    fun registar(ficheiroBase: File, sbn: StatusBarNotification, notificacao: Notification) {
        try {
            val ficheiro = ficheiro(ficheiroBase)
            if (ficheiro.length() > MAXIMO_BYTES) cortarMetade(ficheiro)
            ficheiro.appendText("${linha(sbn, notificacao)}\n")
        } catch (e: Exception) {
            // O coletor nunca pode ser a razão de uma captura falhar.
            Log.w("ContasBabe", "coletor: falha a registar", e)
        }
    }

    private fun linha(sbn: StatusBarNotification, notificacao: Notification): String {
        val extras: Bundle? = notificacao.extras
        return JSONObject()
            .put("pacote", sbn.packageName)
            .put("recebidaEmMs", sbn.postTime)
            .put("chave", sbn.key)
            .put("canal", notificacao.channelId)
            .put("flags", notificacao.flags)
            .put("resumoDeGrupo", notificacao.flags and Notification.FLAG_GROUP_SUMMARY != 0)
            .put("grupo", notificacao.group)
            .put("titulo", texto(extras, Notification.EXTRA_TITLE))
            .put("texto", texto(extras, Notification.EXTRA_TEXT))
            .put("bigText", texto(extras, Notification.EXTRA_BIG_TEXT))
            .put("subText", texto(extras, Notification.EXTRA_SUB_TEXT))
            .put("infoText", texto(extras, Notification.EXTRA_INFO_TEXT))
            .put("linhas", linhas(extras))
            .toString()
    }

    private fun texto(extras: Bundle?, chave: String): Any =
        extras?.getCharSequence(chave)?.toString() ?: JSONObject.NULL

    private fun linhas(extras: Bundle?): Any {
        val valores = extras?.getCharSequenceArray(Notification.EXTRA_TEXT_LINES) ?: return JSONObject.NULL
        return JSONArray().apply { for (v in valores) put(v.toString()) }
    }

    fun ficheiro(base: File): File = File(base, FICHEIRO)

    fun tamanho(base: File): Long = ficheiro(base).length()

    fun linhas(base: File): Int {
        val f = ficheiro(base)
        if (!f.exists()) return 0
        return f.useLines { it.count() }
    }

    fun limpar(base: File) {
        ficheiro(base).delete()
    }

    /** Deita fora a metade mais antiga: os textos recentes são os que interessam. */
    private fun cortarMetade(ficheiro: File) {
        val todas = ficheiro.readLines()
        ficheiro.writeText(todas.drop(todas.size / 2).joinToString("\n", postfix = "\n"))
    }
}
