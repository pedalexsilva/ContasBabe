package pt.contasbabe

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.getcapacitor.BridgeActivity

class MainActivity : BridgeActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        // Os plugins da app registam-se antes do super, senão a ponte arranca
        // sem eles e o ecrã de debug não encontra nada do outro lado.
        registerPlugin(ParserPlugin::class.java)
        super.onCreate(savedInstanceState)

        Notificacoes.criarCanais(this)
        Lembrete.agendar(this)
        pedirPermissaoNotificacoes()
    }

    /**
     * A partir do Android 13, publicar notificações precisa de permissão em
     * runtime — separada e independente do acesso a ler notificações. Sem ela,
     * a captura funciona e a confirmação nunca aparece: o fluxo todo parece
     * morto sem dar um único erro.
     */
    private fun pedirPermissaoNotificacoes() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) return
        val concedida = ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS)
        if (concedida == PackageManager.PERMISSION_GRANTED) return
        ActivityCompat.requestPermissions(this, arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
    }
}
