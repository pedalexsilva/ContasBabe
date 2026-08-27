package pt.contasbabe

import android.content.Context
import pt.contasbabe.nucleo.NotificacaoBruta

/**
 * Memória curta de notificações já processadas.
 *
 * `onNotificationPosted` dispara outra vez sempre que uma notificação é
 * atualizada — e as apps de bancos atualizam-nas por tudo e por nada. Sem isto,
 * uma notificação que se atualize sozinha cria uma despesa de cada vez.
 *
 * É diferente da deduplicação do `:nucleo`: aqui é a mesma notificação a
 * chegar duas vezes; lá são duas notificações diferentes sobre a mesma compra.
 */
object Repostos {

    private const val PREFS = "contasbabe.repostos"
    private const val VALIDADE_MS = 10 * 60 * 1000L

    @Synchronized
    fun jaVisto(ctx: Context, chave: String?, bruta: NotificacaoBruta): Boolean {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val agora = System.currentTimeMillis()
        val id = "${chave ?: bruta.pacote}#${bruta.textoCompleto.hashCode()}"

        val visto = prefs.getLong(id, 0L)
        if (visto != 0L && agora - visto < VALIDADE_MS) return true

        val editor = prefs.edit()
        // A limpeza vai junto com a escrita: sem ela, este ficheiro cresce para
        // sempre com entradas que já não servem para nada.
        for ((chaveAntiga, quando) in prefs.all) {
            if (quando is Long && agora - quando >= VALIDADE_MS) editor.remove(chaveAntiga)
        }
        editor.putLong(id, agora).apply()
        return false
    }
}
