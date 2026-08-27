package pt.contasbabe

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import java.util.Calendar
import java.util.concurrent.Executors

/**
 * Lembrete diário às 21h30, se houver despesas por tratar.
 *
 * Usa `setAndAllowWhileIdle` em vez de um alarme exato de propósito: a partir
 * do Android 12 os alarmes exatos precisam de uma permissão especial que o
 * utilizador tem de conceder à mão, e para um lembrete que tolera uns minutos
 * de atraso não vale a pena esse atrito.
 */
object Lembrete {

    private const val HORA = 21
    private const val MINUTO = 30

    fun agendar(ctx: Context) {
        val gestor = ctx.getSystemService(AlarmManager::class.java) ?: return
        gestor.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, proximaHora(), pendente(ctx))
    }

    private fun proximaHora(): Long {
        val agora = Calendar.getInstance()
        val alvo = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, HORA)
            set(Calendar.MINUTE, MINUTO)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
        }
        if (!alvo.after(agora)) alvo.add(Calendar.DAY_OF_YEAR, 1)
        return alvo.timeInMillis
    }

    private fun pendente(ctx: Context): PendingIntent = PendingIntent.getBroadcast(
        ctx,
        0,
        Intent(ctx, LembreteReceiver::class.java),
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
}

class LembreteReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        val resultado = goAsync()
        EXECUTOR.execute {
            try {
                val ligacao = Repositorio.ligacao(ctx)
                if (ligacao != null) {
                    val quantas = Repositorio.contarPendentes(ligacao.casalId, ligacao.pessoaId)
                    if (quantas > 0) Notificacoes.lembretePendentes(ctx, quantas)
                }
            } catch (e: Exception) {
                Log.e("ContasBabe", "falha no lembrete diário", e)
            } finally {
                // Remarcar acontece sempre, mesmo depois de uma falha: um
                // lembrete que falha uma vez não pode desaparecer para sempre.
                Lembrete.agendar(ctx)
                resultado.finish()
            }
        }
    }

    private companion object {
        val EXECUTOR: java.util.concurrent.ExecutorService = Executors.newSingleThreadExecutor()
    }
}

/** Um reboot apaga os alarmes; uma atualização da app também. */
class ArranqueReceiver : BroadcastReceiver() {
    override fun onReceive(ctx: Context, intent: Intent) {
        Lembrete.agendar(ctx)
        // A recuperação para o serviço morto que o plano prevê. Depois de um
        // reboot o sistema nem sempre volta a ligar-se ao listener sozinho.
        NotificationListener.pedirReligacao(ctx)
    }
}
