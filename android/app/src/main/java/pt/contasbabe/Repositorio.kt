package pt.contasbabe

import android.content.Context
import android.util.Log
import com.google.android.gms.tasks.Tasks
import com.google.firebase.Timestamp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.firestore.FirebaseFirestore
import com.google.firebase.firestore.Query
import com.google.firebase.firestore.QuerySnapshot
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.Source
import pt.contasbabe.nucleo.Captura
import pt.contasbabe.nucleo.DespesaExistente
import pt.contasbabe.nucleo.JanelaEvento
import pt.contasbabe.nucleo.Origem
import java.util.Date
import java.util.concurrent.TimeUnit

/**
 * Acesso ao Firestore a partir do lado nativo.
 *
 * Duas regras que atravessam tudo aqui:
 *
 *  1. **As escritas nunca são esperadas.** O `Task` de uma escrita só completa
 *     quando o servidor confirma; offline, nunca completa. Mas o SDK grava no
 *     cache primeiro e sincroniza sozinho depois, por isso a despesa capturada
 *     num hotel sem Wi-Fi fica gravada na mesma. Esperar pelo Task seria
 *     esperar pela rede — exatamente o que não se quer.
 *
 *  2. **As leituras vão ao cache.** `Source.CACHE` tem de ser explícito: sem
 *     ele, com rede, a query vai ao servidor e é faturada. A deduplicação corre
 *     sobre despesas escritas há segundos por este mesmo processo, que estão
 *     garantidamente no cache local.
 *
 * Tudo o que está aqui bloqueia, e por isso só pode ser chamado a partir do
 * executor do serviço, nunca da main thread.
 */
object Repositorio {

    private const val TAG = "ContasBabe"
    private const val PREFS = "contasbabe"
    private const val CHAVE_CASAL = "casalId"
    private const val CHAVE_PESSOA = "pessoaId"
    private const val CHAVE_UID = "uid"
    private const val CHAVE_EVENTOS_SINCRONIZADOS = "eventosSincronizados"
    private const val SEGUNDOS_ESPERA = 10L

    /** Quantas despesas recentes puxar para a janela de deduplicação. */
    private const val JANELA_CANDIDATAS = 40

    data class Ligacao(val casalId: String, val pessoaId: String)

    private val db: FirebaseFirestore get() = FirebaseFirestore.getInstance()

    /**
     * Descobre a que casal e a que pessoa corresponde a sessão nativa.
     *
     * A sessão é a do SDK nativo — a mesma que a UI usa. Se o login vivesse só
     * no JavaScript, isto devolvia `null` para sempre e o serviço escrevia
     * anónimo, com as regras a rejeitar tudo em silêncio.
     */
    fun ligacao(ctx: Context): Ligacao? {
        val uid = FirebaseAuth.getInstance().currentUser?.uid ?: return null
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

        // O UID guarda-se com o resto: sem ele, terminar sessão e entrar com a
        // outra conta no mesmo telemóvel devolvia a pessoa errada em cache, e
        // as despesas iam parar ao nome de quem não pagou.
        val casalCache = prefs.getString(CHAVE_CASAL, null)
        val pessoaCache = prefs.getString(CHAVE_PESSOA, null)
        if (casalCache != null && pessoaCache != null && prefs.getString(CHAVE_UID, null) == uid) {
            return Ligacao(casalCache, pessoaCache)
        }

        val doc = primeiroDe(
            db.collection("casais").whereArrayContains("membros", uid).limit(1)
        ) ?: return null

        @Suppress("UNCHECKED_CAST")
        val pessoas = doc.get("pessoas") as? List<Map<String, Any?>> ?: return null
        val pessoaId = pessoas.firstOrNull { it["uid"] == uid }?.get("id") as? String ?: return null

        prefs.edit()
            .putString(CHAVE_CASAL, doc.id)
            .putString(CHAVE_PESSOA, pessoaId)
            .putString(CHAVE_UID, uid)
            .apply()

        return Ligacao(doc.id, pessoaId)
    }

    /**
     * As despesas recentes desta pessoa, para a deduplicação decidir.
     *
     * Inclui as descartadas de propósito: sem elas, descartar a captura do
     * MB Way deixava a do Santander, 45 segundos depois, não encontrar par e
     * renascer como despesa.
     */
    fun candidatasDedup(casalId: String, pessoaId: String): List<DespesaExistente> {
        val snap = try {
            Tasks.await(
                db.collection("casais/$casalId/despesas")
                    .whereEqualTo("pagouId", pessoaId)
                    .orderBy("ocorreuEm", Query.Direction.DESCENDING)
                    .limit(JANELA_CANDIDATAS.toLong())
                    .get(Source.CACHE),
                SEGUNDOS_ESPERA, TimeUnit.SECONDS,
            )
        } catch (e: Exception) {
            Log.w(TAG, "dedup: cache indisponível, a criar sem par", e)
            return emptyList()
        }

        return snap.documents.mapNotNull { d ->
            val valor = (d.getLong("valorCent") ?: return@mapNotNull null).toInt()
            val quando = d.getTimestamp("ocorreuEm") ?: return@mapNotNull null
            val origem = Origem.de(d.getString("origem") ?: "") ?: return@mapNotNull null
            DespesaExistente(
                id = d.id,
                valorCent = valor,
                pagouId = d.getString("pagouId") ?: return@mapNotNull null,
                ocorreuEmMs = quando.toDate().time,
                origem = origem,
                cartaoLast4 = d.getString("cartaoLast4"),
                estado = d.getString("estado") ?: "pendente",
                rawText = d.getString("rawText"),
            )
        }
    }

    /** Devolve o id logo, sem esperar pela rede: o `document()` gera-o localmente. */
    fun criarDespesa(
        casalId: String,
        pessoaId: String,
        captura: Captura,
        ocorreuEmMs: Long,
    ): String {
        val ref = db.collection("casais/$casalId/despesas").document()
        ref.set(
            mapOf(
                "eventoId" to null,
                "pagouId" to pessoaId,
                "valorCent" to captura.valorCent,
                "descricao" to null,
                "comerciante" to captura.comerciante,
                "soMinha" to false,
                "origem" to captura.origem.chave,
                "cartaoLast4" to captura.cartaoLast4,
                "rawText" to captura.rawText,
                "ocorreuEm" to Timestamp(Date(ocorreuEmMs)),
                "estado" to "pendente",
            )
        )
        return ref.id
    }

    /**
     * O par ganha o comerciante que só a origem primária traz.
     *
     * O `rawText` acumula em vez de substituir: os dois textos são o par, e é o
     * par que permite perceber, mais tarde, porque é que a deduplicação decidiu
     * o que decidiu.
     */
    fun enriquecer(casalId: String, despesaId: String, captura: Captura, rawAnterior: String?) {
        val campos = mutableMapOf<String, Any?>(
            "origem" to captura.origem.chave,
            "rawText" to listOfNotNull(rawAnterior, captura.rawText).joinToString("\n---\n"),
        )
        if (captura.comerciante != null) campos["comerciante"] = captura.comerciante
        db.document("casais/$casalId/despesas/$despesaId").update(campos)
    }

    fun preencherLast4(casalId: String, despesaId: String, last4: String) {
        db.document("casais/$casalId/despesas/$despesaId").update("cartaoLast4", last4)
    }

    fun confirmar(casalId: String, despesaId: String, eventoId: String) {
        db.document("casais/$casalId/despesas/$despesaId")
            .update(mapOf("eventoId" to eventoId, "estado" to "confirmada"))
    }

    fun descartar(casalId: String, despesaId: String) {
        db.document("casais/$casalId/despesas/$despesaId")
            .update(mapOf("eventoId" to null, "estado" to "descartada"))
    }

    fun apagar(casalId: String, despesaId: String) {
        db.document("casais/$casalId/despesas/$despesaId").delete()
    }

    /**
     * Os eventos do casal, para decidir se há algum ativo.
     *
     * "Cache frio" e "coleção legitimamente vazia" são indistinguíveis, e fora
     * de viagem a coleção de eventos ativos está vazia por definição. Sem a
     * marca de já-sincronizei, cada notificação de banco ia ao servidor — e
     * offline ficava dez segundos a bloquear o executor do listener, com as
     * notificações seguintes em fila atrás dela.
     */
    fun eventos(ctx: Context, casalId: String): List<JanelaEvento> {
        val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        val colecao = db.collection("casais/$casalId/eventos")

        val doCache = esperar(colecao.get(Source.CACHE))
        val snap = if (doCache != null && (!doCache.isEmpty || prefs.getBoolean(CHAVE_EVENTOS_SINCRONIZADOS, false))) {
            doCache
        } else {
            esperar(colecao.get(Source.SERVER))?.also {
                prefs.edit().putBoolean(CHAVE_EVENTOS_SINCRONIZADOS, true).apply()
            } ?: return emptyList()
        }

        return snap.documents.mapNotNull { d ->
            val inicio = d.getTimestamp("inicio") ?: return@mapNotNull null
            val fim = d.getTimestamp("fim") ?: return@mapNotNull null
            JanelaEvento(
                id = d.id,
                nome = d.getString("nome") ?: return@mapNotNull null,
                inicioMs = inicio.toDate().time,
                fimMs = fim.toDate().time,
                fechado = d.getTimestamp("fechadoEm") != null,
            )
        }
    }

    /** Quantas despesas estão à espera de evento. Alimenta o lembrete diário. */
    fun contarPendentes(casalId: String, pessoaId: String): Int {
        val snap = esperar(
            db.collection("casais/$casalId/despesas")
                .whereEqualTo("pagouId", pessoaId)
                .whereEqualTo("estado", "pendente")
                .get(Source.CACHE)
        ) ?: return 0
        return snap.size()
    }

    /**
     * Sinal de vida, no Firestore e não no telemóvel: o telemóvel da Lisa com o
     * serviço morto é invisível para a Lisa, mas o Pedro abre a app e vê.
     */
    fun heartbeat(casalId: String, pessoaId: String, houveCaptura: Boolean) {
        val campos = mutableMapOf<String, Any?>("vistoEm" to Timestamp.now())
        if (houveCaptura) campos["ultimaCapturaEm"] = Timestamp.now()
        db.document("casais/$casalId/heartbeats/$pessoaId")
            .set(campos, SetOptions.merge())
    }

    private fun primeiroDe(query: Query) =
        esperar(query.get(Source.CACHE))?.documents?.firstOrNull()
            ?: esperar(query.get(Source.SERVER))?.documents?.firstOrNull()

    private fun esperar(task: com.google.android.gms.tasks.Task<QuerySnapshot>): QuerySnapshot? =
        try {
            Tasks.await(task, SEGUNDOS_ESPERA, TimeUnit.SECONDS)
        } catch (e: Exception) {
            Log.w(TAG, "leitura falhou", e)
            null
        }
}
