package pt.contasbabe

import android.app.Notification
import android.content.ComponentName
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import pt.contasbabe.debug.Coletor
import pt.contasbabe.nucleo.Decisao
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.ativos
import pt.contasbabe.nucleo.decidir
import pt.contasbabe.nucleo.parsers.Parsers
import java.util.concurrent.Executors

/**
 * O serviço que está sempre vivo. Corre com a app fechada, e é a razão de o
 * núcleo ter de ser nativo: nada disto pode depender de acordar uma WebView.
 *
 * Aqui só há cola. Toda a decisão — o que é uma despesa, o que é duplicado, o
 * que é um evento ativo — vive no módulo `:nucleo`, em Kotlin puro, com testes
 * que correm em JUnit sem telemóvel nenhum.
 */
class NotificationListener : NotificationListenerService() {

    private val executor = Executors.newSingleThreadExecutor()
    private var ultimoHeartbeatMs = 0L

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.i(TAG, "listener ligado")
        executor.execute { heartbeat(houveCaptura = false) }
        Lembrete.agendar(applicationContext)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        val notificacao = sbn.notification ?: return

        // O corpus regista TUDO, antes de qualquer filtro. Se os resumos de grupo
        // saíssem daqui sem deixar rasto, não haveria como verificar depois se o
        // filtro está a comer notificações legítimas.
        executor.execute {
            Coletor.registar(applicationContext.filesDir, sbn, notificacao)
            // Qualquer notificação prova que o serviço está vivo — não só as de
            // bancos. Sem isto, um dia fora de viagem bastava para a app do outro
            // dizer "o serviço está morto, verifica a bateria".
            heartbeat(houveCaptura = false)
        }

        // O Android publica o mesmo conteúdo na notificação individual e no
        // resumo do grupo. Sem este filtro, captura-se tudo a dobrar.
        if (notificacao.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = notificacao.extras ?: return
        val titulo = texto(extras, Notification.EXTRA_TITLE)
        // Muitas apps de bancos põem o conteúdo útil no bigText e deixam o
        // EXTRA_TEXT truncado com reticências.
        val corpo = texto(extras, Notification.EXTRA_BIG_TEXT)
            .ifBlank { texto(extras, Notification.EXTRA_TEXT) }
            .ifBlank { linhas(extras) }
            .ifBlank { texto(extras, Notification.EXTRA_SUB_TEXT) }

        if (titulo.isBlank() && corpo.isBlank()) return

        val bruta = NotificacaoBruta(
            pacote = sbn.packageName ?: return,
            titulo = titulo,
            texto = corpo,
            recebidaEmMs = sbn.postTime,
        )

        executor.execute { processar(sbn.key, bruta) }
    }

    private fun processar(chave: String?, bruta: NotificacaoBruta) {
        try {
            // `onNotificationPosted` volta a disparar quando uma notificação é
            // atualizada. Sem este filtro, uma notificação que se atualize
            // sozinha cria uma despesa de cada vez.
            if (Repostos.jaVisto(applicationContext, chave, bruta)) return

            val captura = Parsers.parse(bruta) ?: return

            val ligacao = Repositorio.ligacao(applicationContext) ?: run {
                Log.w(TAG, "captura ignorada: sessão nativa sem utilizador ou casal")
                return
            }

            // Sem evento ativo não se notifica nem se grava. A janela vai até
            // três dias depois do fim, para os reembolsos não se perderem.
            val eventos = ativos(
                Repositorio.eventos(applicationContext, ligacao.casalId),
                bruta.recebidaEmMs,
            )
            if (eventos.isEmpty()) {
                Log.i(TAG, "captura ignorada: nenhum evento ativo")
                return
            }

            val candidatas = Repositorio.candidatasDedup(ligacao.casalId, ligacao.pessoaId)
            when (val decisao = decidir(captura, ligacao.pessoaId, bruta.recebidaEmMs, candidatas)) {
                is Decisao.Descartar -> {
                    decisao.last4APreencher?.let {
                        Repositorio.preencherLast4(ligacao.casalId, decisao.parId, it)
                    }
                    Log.i(TAG, "duplicado descartado, par ${decisao.parId}")
                }

                is Decisao.Enriquecer -> {
                    val par = candidatas.firstOrNull { it.id == decisao.parId }
                    Repositorio.enriquecer(ligacao.casalId, decisao.parId, captura, par?.rawText)

                    // Só se pede confirmação de uma despesa que ainda esteja à
                    // espera dela. Republicar por cima de uma já confirmada, ou
                    // de uma que acabaste de descartar, punha-a outra vez à tua
                    // frente logo a seguir a a teres despachado.
                    if (par?.estado == "pendente") {
                        Notificacoes.pedirConfirmacao(
                            applicationContext, ligacao.casalId, decisao.parId, captura, eventos,
                        )
                    }
                }

                Decisao.Criar -> {
                    val id = Repositorio.criarDespesa(
                        ligacao.casalId, ligacao.pessoaId, captura, bruta.recebidaEmMs,
                    )
                    Notificacoes.pedirConfirmacao(
                        applicationContext, ligacao.casalId, id, captura, eventos,
                    )
                }
            }

            heartbeat(houveCaptura = true)
        } catch (e: Exception) {
            // Uma exceção aqui mataria o serviço e a app ficava cega sem avisar.
            Log.e(TAG, "falha a processar notificação de ${bruta.pacote}", e)
        }
    }

    private fun heartbeat(houveCaptura: Boolean) {
        val agora = System.currentTimeMillis()
        if (!houveCaptura && agora - ultimoHeartbeatMs < INTERVALO_HEARTBEAT_MS) return
        ultimoHeartbeatMs = agora
        val ligacao = Repositorio.ligacao(applicationContext) ?: return
        Repositorio.heartbeat(ligacao.casalId, ligacao.pessoaId, houveCaptura)
    }

    private fun texto(extras: android.os.Bundle, chave: String): String =
        extras.getCharSequence(chave)?.toString()?.trim().orEmpty()

    private fun linhas(extras: android.os.Bundle): String =
        extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.joinToString("\n") { it.toString() }
            ?.trim()
            .orEmpty()

    companion object {
        private const val TAG = "ContasBabe"

        /** Uma escrita por hora, no máximo. Ao dia dá troco de nada na quota. */
        private const val INTERVALO_HEARTBEAT_MS = 60 * 60 * 1000L

        /**
         * A recuperação para o serviço morto que o plano prevê: pede ao sistema
         * que volte a ligar-se ao listener. Não faz nada se a permissão tiver
         * sido retirada — aí só as definições resolvem.
         */
        fun pedirReligacao(ctx: android.content.Context) {
            try {
                requestRebind(ComponentName(ctx, NotificationListener::class.java))
            } catch (e: Exception) {
                Log.w(TAG, "requestRebind falhou", e)
            }
        }
    }
}
