package pt.contasbabe

import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationManagerCompat
import java.util.concurrent.Executors

/**
 * Responde aos botões da notificação de confirmação.
 *
 * Só faz escritas — nunca abre ecrãs. Desde o Android 12, abrir uma Activity a
 * partir de um receiver ("notification trampoline") é bloqueado pelo sistema, e
 * é por isso que o botão que abre a lista é um PendingIntent de Activity feito
 * em `Notificacoes`, e não passa por aqui.
 */
class ConfirmacaoReceiver : BroadcastReceiver() {

    override fun onReceive(ctx: Context, intent: Intent) {
        val casalId = intent.getStringExtra(EXTRA_CASAL) ?: return
        val despesaId = intent.getStringExtra(EXTRA_DESPESA) ?: return
        val eventoId = intent.getStringExtra(EXTRA_EVENTO)

        NotificationManagerCompat.from(ctx).cancel(despesaId.hashCode())

        // O receiver corre na main thread e o `goAsync` dá-lhe folga para uma
        // escrita local. A escrita não é esperada: vai para o cache e sobe
        // sozinha, por isso isto acaba em milissegundos mesmo sem rede.
        val resultado = goAsync()
        EXECUTOR.execute {
            try {
                if (intent.action == ACAO_DESCARTAR) {
                    Repositorio.descartar(casalId, despesaId)
                } else if (eventoId != null) {
                    Repositorio.confirmar(casalId, despesaId, eventoId)
                }
            } catch (e: Exception) {
                Log.e("ContasBabe", "falha a responder à confirmação", e)
            } finally {
                resultado.finish()
            }
        }
    }

    companion object {
        private const val ACAO_ATRIBUIR = "pt.contasbabe.ATRIBUIR"
        private const val ACAO_DESCARTAR = "pt.contasbabe.DESCARTAR"
        private const val EXTRA_CASAL = "casalId"
        private const val EXTRA_DESPESA = "despesaId"
        private const val EXTRA_EVENTO = "eventoId"

        private val EXECUTOR = Executors.newSingleThreadExecutor()

        fun intentAtribuir(
            ctx: Context,
            casalId: String,
            despesaId: String,
            eventoId: String,
        ): PendingIntent = pendente(
            ctx,
            Intent(ctx, ConfirmacaoReceiver::class.java)
                .setAction(ACAO_ATRIBUIR)
                .putExtra(EXTRA_CASAL, casalId)
                .putExtra(EXTRA_DESPESA, despesaId)
                .putExtra(EXTRA_EVENTO, eventoId),
            "$despesaId:$eventoId",
        )

        fun intentDescartar(ctx: Context, casalId: String, despesaId: String): PendingIntent =
            pendente(
                ctx,
                Intent(ctx, ConfirmacaoReceiver::class.java)
                    .setAction(ACAO_DESCARTAR)
                    .putExtra(EXTRA_CASAL, casalId)
                    .putExtra(EXTRA_DESPESA, despesaId),
                "$despesaId:descartar",
            )

        private fun pendente(ctx: Context, intent: Intent, chave: String): PendingIntent =
            PendingIntent.getBroadcast(
                ctx,
                chave.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
            )
    }
}
