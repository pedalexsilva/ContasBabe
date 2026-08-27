package pt.contasbabe

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.JanelaEvento

/**
 * A notificação de confirmação e o lembrete diário.
 *
 * O Android mostra no máximo três ações, e o desenho usa o limite todo:
 * atribuir, descartar, escolher outro.
 */
object Notificacoes {

    private const val CANAL_CONFIRMACAO = "confirmacao"
    private const val CANAL_LEMBRETE = "lembrete"
    const val ID_LEMBRETE = 1

    fun criarCanais(ctx: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val gestor = ctx.getSystemService(NotificationManager::class.java) ?: return
        gestor.createNotificationChannel(
            NotificationChannel(
                CANAL_CONFIRMACAO,
                "Confirmação de despesas",
                NotificationManager.IMPORTANCE_HIGH,
            ).apply { description = "Aparece quando uma compra é capturada durante um evento." }
        )
        gestor.createNotificationChannel(
            NotificationChannel(
                CANAL_LEMBRETE,
                "Lembrete diário",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply { description = "Às 21h30, se houver despesas por tratar." }
        )
    }

    fun pedirConfirmacao(
        ctx: Context,
        casalId: String,
        despesaId: String,
        captura: Captura,
        ativos: List<JanelaEvento>,
    ) {
        criarCanais(ctx)

        val titulo = captura.comerciante ?: "Compra sem comerciante"
        val builder = NotificationCompat.Builder(ctx, CANAL_CONFIRMACAO)
            .setSmallIcon(android.R.drawable.ic_menu_save)
            .setContentTitle("$titulo — ${euros(captura.valorCent)}")
            .setContentText(
                if (captura.comerciante == null) "Toca para dar uma descrição" else "A que evento pertence?"
            )
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(abrirPorTratar(ctx, despesaId))

        if (ativos.size == 1) {
            val evento = ativos[0]
            builder.addAction(
                0,
                evento.nome,
                ConfirmacaoReceiver.intentAtribuir(ctx, casalId, despesaId, evento.id),
            )
        } else {
            // Com vários eventos ativos não há botão óbvio: o primeiro abre a
            // lista. Tem de ser um PendingIntent de Activity — desde o Android
            // 12 um receiver não pode abrir ecrãs.
            builder.addAction(0, "Escolher evento", abrirPorTratar(ctx, despesaId))
        }

        builder.addAction(
            0,
            "Não é da viagem",
            ConfirmacaoReceiver.intentDescartar(ctx, casalId, despesaId),
        )

        if (ativos.size == 1) {
            builder.addAction(0, "Outro evento", abrirPorTratar(ctx, despesaId))
        }

        publicar(ctx, despesaId.hashCode(), builder.build())
    }

    fun lembretePendentes(ctx: Context, quantas: Int) {
        criarCanais(ctx)
        val texto = if (quantas == 1) "1 despesa por tratar" else "$quantas despesas por tratar"
        val notificacao = NotificationCompat.Builder(ctx, CANAL_LEMBRETE)
            .setSmallIcon(android.R.drawable.ic_menu_agenda)
            .setContentTitle(texto)
            .setContentText("Toca para as atribuir todas de seguida.")
            .setAutoCancel(true)
            .setContentIntent(abrirPorTratar(ctx, null))
            .build()
        publicar(ctx, ID_LEMBRETE, notificacao)
    }

    /**
     * A `POST_NOTIFICATIONS` é pedida em runtime a partir do Android 13, e pode
     * estar negada. Publicar sem ela lança `SecurityException` e mataria o
     * serviço a meio de uma captura.
     */
    private fun publicar(ctx: Context, id: Int, notificacao: android.app.Notification) {
        try {
            NotificationManagerCompat.from(ctx).notify(id, notificacao)
        } catch (e: SecurityException) {
            android.util.Log.w("ContasBabe", "sem permissão para publicar notificações", e)
        }
    }

    private fun abrirPorTratar(ctx: Context, despesaId: String?): PendingIntent {
        val uri = if (despesaId == null) {
            Uri.parse("contasbabe://por-tratar")
        } else {
            Uri.parse("contasbabe://por-tratar?despesa=$despesaId")
        }
        val intent = Intent(Intent.ACTION_VIEW, uri, ctx, MainActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
        return PendingIntent.getActivity(
            ctx,
            (despesaId ?: "lembrete").hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
    }

    /** Só para o texto da notificação; o cálculo nunca vê euros. */
    private fun euros(cent: Int): String {
        val sinal = if (cent < 0) "-" else ""
        val abs = kotlin.math.abs(cent)
        return "$sinal${abs / 100},${(abs % 100).toString().padStart(2, '0')} €"
    }
}
