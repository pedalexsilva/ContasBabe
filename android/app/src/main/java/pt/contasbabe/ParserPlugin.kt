package pt.contasbabe

import android.content.Intent
import android.provider.Settings
import androidx.core.content.FileProvider
import com.getcapacitor.JSArray
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import pt.contasbabe.debug.Coletor
import pt.contasbabe.nucleo.NotificacaoBruta
import pt.contasbabe.nucleo.parsers.Parsers

/**
 * Ponte para o ecrã de debug. O parsing a sério nunca passa por aqui — acontece
 * no `NotificationListenerService`, com a app fechada.
 *
 * Existe para que, quando o banco mudar o texto, se possa colar o texto novo e
 * ver logo onde falha, sem esperar por outra compra.
 */
@CapacitorPlugin(name = "Parser")
class ParserPlugin : Plugin() {

    @PluginMethod
    fun analisar(call: PluginCall) {
        val bruta = NotificacaoBruta(
            pacote = call.getString("pacote").orEmpty(),
            titulo = call.getString("titulo").orEmpty(),
            texto = call.getString("texto").orEmpty(),
            recebidaEmMs = System.currentTimeMillis(),
        )

        val captura = Parsers.parse(bruta)
        val resposta = JSObject()

        if (captura == null) {
            val conhecido = Parsers.TODOS.any { it.aceita(bruta.pacote) }
            resposta.put("reconhecido", false)
            resposta.put("origem", null)
            resposta.put("valorCent", null)
            resposta.put("comerciante", null)
            resposta.put("cartaoLast4", null)
            resposta.put(
                "motivo",
                if (!conhecido) {
                    "Nenhum parser aceita o pacote \"${bruta.pacote}\"."
                } else {
                    "O parser aceita este pacote mas o texto não bateu certo com a estrutura completa — ou é uma notificação a descartar de propósito, como um pedido de 3D Secure."
                },
            )
        } else {
            resposta.put("reconhecido", true)
            resposta.put("origem", captura.origem.chave)
            resposta.put("valorCent", captura.valorCent)
            resposta.put("comerciante", captura.comerciante)
            resposta.put("cartaoLast4", captura.cartaoLast4)
            resposta.put("motivo", null)
        }

        call.resolve(resposta)
    }

    @PluginMethod
    fun pacotesConhecidos(call: PluginCall) {
        val lista = JSArray()
        for (parser in Parsers.TODOS) {
            lista.put(JSObject().put("origem", parser.origem.chave).put("pacote", parser.pacote))
        }
        call.resolve(JSObject().put("pacotes", lista))
    }

    /** Se isto for `false`, a app está cega e não há aviso nenhum do sistema. */
    @PluginMethod
    fun temAcessoNotificacoes(call: PluginCall) {
        val autorizados = Settings.Secure.getString(
            context.contentResolver,
            "enabled_notification_listeners",
        ).orEmpty()
        call.resolve(
            JSObject().put("autorizado", autorizados.contains(context.packageName))
        )
    }

    @PluginMethod
    fun abrirDefinicoesNotificacoes(call: PluginCall) {
        context.startActivity(
            Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        call.resolve()
    }

    /**
     * O Android mata o serviço em segundo plano se a app não estiver excluída da
     * otimização de bateria — e não avisa ninguém quando o faz.
     */
    @PluginMethod
    fun abrirDefinicoesBateria(call: PluginCall) {
        context.startActivity(
            Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        call.resolve()
    }

    @PluginMethod
    fun estadoCorpus(call: PluginCall) {
        call.resolve(
            JSObject()
                .put("linhas", Coletor.linhas(context))
                .put("bytes", Coletor.tamanho(context))
        )
    }

    /** Abre o share sheet com o ficheiro do corpus, para o tirares do telemóvel. */
    @PluginMethod
    fun partilharCorpus(call: PluginCall) {
        val ficheiro = Coletor.ficheiro(context)
        if (!ficheiro.exists()) {
            call.reject("Ainda não há nada recolhido.")
            return
        }

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            ficheiro,
        )
        val partilha = Intent(Intent.ACTION_SEND)
            .setType("text/plain")
            .putExtra(Intent.EXTRA_STREAM, uri)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

        context.startActivity(
            Intent.createChooser(partilha, "Corpus de notificações")
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        )
        call.resolve()
    }

    @PluginMethod
    fun limparCorpus(call: PluginCall) {
        Coletor.limpar(context)
        call.resolve()
    }
}
