# App de despesas partilhadas — plano de desenvolvimento

Duas pessoas, eventos com período definido, captura automática por notificações Android.

---

## 1. Decisões fechadas

| Decisão | Escolha |
|---|---|
| Utilizadores | 2 (Pedro, Lisa), ambos Android |
| Sincronização | Firestore (não pausa por inatividade) |
| Divisão | Percentagem definida no evento, default 50/50 |
| Exceção | Flag "100% minha" por despesa |
| Eventos | Vários em simultâneo, com período (início/fim) |
| Captura | Notificações Android: Wallet + MB Way primárias, Santander como rede de segurança |
| Moeda | Euro apenas |
| Fecho | Um marca como acertado, histórico fica consultável |
| Ecrã inicial | Saldo + caixa "Por tratar" |

## 2. Arquitetura

O núcleo tem de ser **Kotlin nativo**, não negociável. O `NotificationListenerService` corre com a app fechada, e a notificação de confirmação tem de ser publicada e respondida sem acordar nenhuma WebView. Se isso passar por JavaScript, falha exatamente quando é preciso.

A UI pode ser React dentro de Capacitor, reutilizando o teu stack. A fronteira é limpa:

```
┌─────────────────────────────────────────┐
│  Kotlin nativo (sempre vivo)            │
│  • NotificationListenerService          │
│  • Parser por origem                    │
│  • Deduplicação                         │
│  • Notificação com ações                │
│  • Escreve direto no SDK Firestore      │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  Firestore (SDK Android, um só)          │
│  • Cache offline automático              │
│  • Listeners em tempo real               │
│  • Não pausa por inatividade             │
└──────────────┬──────────────────────────┘
               │
┌──────────────▼──────────────────────────┐
│  UI (Capacitor + React)                  │
│  • Eventos, saldos, histórico            │
│  • Registo manual                        │
│  • Caixa "Por tratar"                    │
└─────────────────────────────────────────┘
```

**Não precisas de fila local.** O SDK do Firestore escreve sempre no cache primeiro e sincroniza quando houver rede — uma despesa capturada num hotel sem Wi-Fi fica gravada na mesma e sobe sozinha depois. É a razão principal para escolher isto em vez de Postgres: poupa-te a camada de Room inteira.

### Firebase na UI: SDK nativo, nunca o SDK web

A UI em Capacitor **não usa o SDK JavaScript do Firebase**. Usa `@capacitor-firebase/authentication` e `@capacitor-firebase/firestore`, que fazem ponte para o mesmo SDK Android que o listener usa. Três razões, todas sérias:

1. **O Google Sign-In não funciona em WebViews.** O Google bloqueia OAuth em WebViews embebidas (`disallowed_useragent`). Com `signInWithPopup`/`signInWithRedirect` do SDK web, a Fase 1 encalhava logo no login. Com o plugin, o login corre no fluxo nativo e o problema não existe.
2. **Uma cache, não duas.** O SDK web teria a sua cache em IndexedDB, separada da cache nativa do serviço. Uma despesa capturada offline pelo listener não aparecia na UI do próprio telemóvel até haver rede. Com o SDK nativo partilhado, aparece de imediato.
3. **O serviço herda a sessão.** O `NotificationListenerService` escreve no Firestore com o utilizador autenticado no SDK nativo. Se a autenticação vivesse só no JavaScript, o serviço escrevia anónimo e as regras de segurança rejeitavam tudo — em silêncio.

A API do plugin é mais estreita que a do SDK web, mas cobre o que precisas: `where`, `orderBy`, `limit` e listeners em tempo real.

Regra de processo que protege isto: tudo corre **num único processo Android** — nunca `android:process` no manifest, que dividiria a cache e a sessão em dois.

## 3. Schema

Tudo debaixo de um documento partilhado, para as regras de segurança serem triviais.

```
/casais/{casalId}
    membros: [ "<uid-pedro>", "<uid-lisa>" ]   // UIDs do Firebase Auth — as regras dependem disto
    pessoas: [
      { id: "pedro", uid: "<uid-pedro>", nome: "Pedro" },
      { id: "lisa",  uid: "<uid-lisa>",  nome: "Lisa"  }
    ]

/casais/{casalId}/eventos/{eventoId}
    nome:         "Alentejo"
    inicio:       timestamp
    fim:          timestamp
    percentagens: { pedro: 50.0, lisa: 50.0 }   // por pessoa, soma 100
    fechadoEm:    timestamp | null
    acertadoCent: integer | null

/casais/{casalId}/despesas/{despesaId}
    eventoId:    string | null
    pagouId:     "pedro" | "lisa"
    valorCent:   integer            // cêntimos; negativo = reembolso
    descricao:   string | null
    comerciante: string | null
    soMinha:     boolean
    origem:      "wallet" | "mbway" | "santander" | "manual"
    cartaoLast4: string | null
    rawText:     string | null
    ocorreuEm:   timestamp
    estado:      "pendente" | "confirmada" | "descartada"
```

Notas:

- Dinheiro em **cêntimos inteiros no schema**, não só no cálculo — se o Firestore guardar euros em float, o float acaba por reaparecer no cálculo por muito que a regra diga o contrário.
- `estado` substitui um booleano `tratada`: `pendente` = capturada, na caixa "Por tratar"; `confirmada` = atribuída a um evento (ou marcada manual); `descartada` = "não é da viagem". Descartar **não apaga** o documento — o `rawText` continua no corpus do parser, e a janela de deduplicação continua correta: se descartares a captura do MB Way e o Santander chegar 45 segundos depois, o par ainda existe e o Santander é descartado em vez de renascer como despesa zombie.
- `membros` é um array plano de UIDs porque é o que as regras conseguem testar com `in`; o `uid` dentro de `pessoas` é o que mapeia login → pessoa no primeiro arranque ("escolher quem é quem" grava-o).
- `percentagens` é um mapa por pessoa em vez de um `percPedro`: assim a divisão não depende da ordem do array `pessoas` nem do nome de ninguém, e reordenar o array não troca as percentagens em silêncio.
- `eventoId` preenche-se **só na confirmação**. A sugestão da caixa "Por tratar" deriva-se da data contra as janelas dos eventos, e não se guarda — um campo de sugestão seria mais um sítio para os dados ficarem inconsistentes.
- `rawText` parece supérfluo até o Santander mudar o texto de uma notificação. Aí é o que te permite reparar o parser sem repetir os testes.
- `valorCent` negativo cobre os reembolsos que viste no histórico da Wallet
- Datas em `Timestamp` do Firestore, nunca em string — precisas de ordenar e de fazer intervalos

### Autenticação e regras

Google Sign-In (nativo, via plugin — ver secção 2), e os dois UIDs ficam gravados em `membros`:

```javascript
match /casais/{casalId} {
  allow read, write: if request.auth.uid in resource.data.membros;

  match /{documento=**} {
    allow read, write: if request.auth.uid in
      get(/databases/$(database)/documents/casais/$(casalId)).data.membros;
  }
}
```

O documento do casal cria-se **uma vez, à mão, na consola Firebase**, já com os dois UIDs em `membros`. As regras não precisam de caminho de criação — e `resource.data` num `create` falharia de qualquer forma, porque o documento ainda não existe.

### Índices

Um composto, para a lista de despesas de um evento por ordem cronológica: `eventoId` ascendente + `ocorreuEm` descendente.

A deduplicação **não precisa de índice** — corre com `get(Source.CACHE)` sobre as despesas dos últimos minutos, que acabaram de ser escritas localmente. O `Source.CACHE` tem de ser explícito: sem ele, uma query com rede vai ao servidor e fatura leituras. Com ele: zero leituras faturadas e funciona offline.

### Custo

O plano Spark dá 50 000 leituras e 20 000 escritas por dia. Uma viagem de uma semana gera talvez 40 escritas, mais uma leitura extra por operação para o `get()` das regras. Não há cenário realista em que isto saia do free tier.

## 4. Parsing

Textos reais já recolhidos:

**Santander**
```
Título: Santander
Corpo:  Movimento no valor de EUR 0,95 no cartão ***********0390
```
- Regex: `EUR\s+([\d.,]+).*?cartão\s+\*+(\d{4})`
- Vírgula decimal. Sem comerciante. Dá o last4.
- **Descartar as notificações de 3D Secure** — pedem autorização de uma compra que ainda não aconteceu. Distinguem-se pelo texto (autorizar/confirmar), não pelo formato do valor.

**MB Way**
```
Título: Compra QRCode
Corpo:  Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.
```
- Regex: `comerciante\s+(.+?),\s+no valor de\s+([\d.,]+)\s*€`
- Ponto decimal. Dá comerciante.
- Verificar se transferências entre pessoas usam outro título — se sim, tratar como acerto de contas, não despesa.

**Wallet** — falta o texto exato. Recolher antes de escrever esta regra.

### Normalizador de valores

Uma função só, que devolve cêntimos inteiros, testada contra todos os formatos:

- `0,95`, `0.95`, `EUR 0,95`, `0.95€`
- **Separador de milhares**: `1.234,56` é realista numa fatura de hotel e parte um normalizador ingénuo (a substituição cega de vírgula por ponto dá `1.234.56`). Regra única que resolve tudo: quando aparecem `.` e `,` no mesmo valor, **o último é o separador decimal**; o outro remove-se.
- **Antes de qualquer regex, normalizar espaços**: as apps de bancos adoram non-breaking spaces (` `) e narrow spaces (` `) — invisíveis no log, fatais no `\s` de uma regex mal afinada. Converter tudo em espaço simples primeiro.

### Identificação das origens

Não confies em nomes de package que eu ou qualquer outra fonte te dê — confirma-os no teu telemóvel. Constrói primeiro um **modo de captura**: o listener regista `packageName`, **todos os extras** (`EXTRA_TITLE`, `EXTRA_TEXT`, `EXTRA_BIG_TEXT`, `EXTRA_TEXT_LINES`, `EXTRA_SUB_TEXT`), canal, flags (incluindo se é resumo de grupo) e timestamp de tudo, e escreve num ficheiro. Os extras completos importam: muitas apps bancárias põem o conteúdo útil no `bigText` e deixam o `EXTRA_TEXT` truncado — se o coletor só guardar título e texto, escreves o parser contra a versão cortada. Uma semana de uso normal dá-te o corpus e os identificadores certos de uma vez.

### Deduplicação

Antes de tudo, dois filtros no próprio listener, ainda antes do parsing:

- **Ignorar resumos de grupo** (`FLAG_GROUP_SUMMARY`). O Android publica o mesmo conteúdo na notificação individual e no resumo do grupo; sem este filtro capturas tudo em duplicado logo à cabeça.
- **Ignorar reposts.** `onNotificationPosted` dispara outra vez quando uma notificação é atualizada. Guarda (chave da notificação + hash do texto) dos últimos 10 minutos em SharedPreferences e salta o que já processaste.

Depois, a deduplicação entre origens. Quando chega uma notificação nova, procura despesa com o mesmo valor, mesmo pagador, `ocorreuEm` dentro de ±3 minutos — **incluindo descartadas**, com `Source.CACHE`:

```
nova é santander e existe par        → descartar a nova
                                       (aproveitar para gravar o cartaoLast4 se faltar)
nova é primária e o par é santander  → atualizar a existente com comerciante e origem
nova é primária e o par é da mesma
origem primária                      → criar na mesma — são duas compras reais
                                       (dois cafés iguais em rondas seguidas; os reposts
                                       já morreram no filtro acima)
não existe par                       → criar
```

Na dúvida, o desempate é sempre o mesmo: **criar**. Um duplicado vê-se e apaga-se num toque; uma despesa engolida pela deduplicação nunca mais aparece.

Mediste 45 segundos entre MB Way e Santander. Três minutos dá margem para redes más sem risco realista de colisão.

Consequência útil: uma notificação do Santander que **não** encontre par é uma compra que nenhuma primária viu — compra online, ou pagamento com o cartão físico em vez do telemóvel. Essa cria despesa e pede-te descrição, porque não traz comerciante.

## 5. Fluxo de confirmação

Notificação nativa com ações:

```
Café Orfeu — 0,95 €
[Alentejo]  [Não é da viagem]  [Outro evento]
```

(Três ações é também o máximo que o Android mostra — o desenho usa o limite todo.)

- Um evento ativo → botão direto com o nome dele
- Vários ativos → o primeiro botão abre a lista
- Nenhum ativo → não notifica de todo, e nem sequer grava

Para efeitos de captura, "ativo" é `inicio ≤ agora ≤ fim + 3 dias` e não fechado. Os três dias de tolerância existem porque cauções, acertos de pré-autorização e sobretudo **reembolsos chegam depois de a viagem acabar** — com um fim seco, o reembolso do hotel caía no vazio sem aviso, precisamente o tipo de despesa que o plano diz suportar. Nesse período a despesa entra como `pendente` com o evento acabado como sugestão.

"Não é da viagem" marca `estado = descartada` — sai da vista, fica no corpus (secção 3). Sem confirmação, cai em "Por tratar" com `estado = pendente`.

Detalhe de implementação que não é detalhe: desde o Android 12, abrir uma Activity a partir de um BroadcastReceiver ("notification trampoline") é bloqueado. Os botões de atribuição direta e de descartar respondem no `ConfirmacaoReceiver`; o botão **[Outro evento]**, que abre a lista, tem de ser um `PendingIntent` de Activity diretamente.

**Lembrete diário** às 21h30, se houver pendentes: uma notificação, ecrã de lista, atribuis tudo de seguida.

## 6. Cálculo do saldo

Tudo em cêntimos inteiros:

```
Para cada pessoa:
  pagou       = soma de todas as despesas dela no evento
  pessoais    = soma das despesas dela marcadas so_minha
  contribuiu  = pagou - pessoais

comum = contribuiu_A + contribuiu_B
devia_A = round(comum × perc_A / 100)
devia_B = comum - devia_A

saldo_A = contribuiu_A - devia_A
```

O `round` só em `devia_A`, com `devia_B` por diferença: numa divisão 60/40 de um valor ímpar, é o que garante que nunca se perde nem se inventa um cêntimo.

Positivo = tem a receber. Exemplo teu: 50 e 75, a 50/50 → comum 125, cada um devia 62,50 → Pedro −12,50, ou seja deve 12,50 € à Lisa.

Reembolsos entram como valor negativo e o cálculo não muda.

O **saldo do ecrã inicial** é a soma dos saldos de todos os eventos ainda não fechados — com vários eventos em simultâneo, é o único número que responde a "quem deve a quem, agora".

## 7. Dashboard anual

Vista separada, consultada fora das viagens.

- **Total do ano** como número dominante. Eventos ainda abertos entram, mas marcados — senão o número está sempre errado durante a viagem, que é quando o vais ver.
- **Barras por evento, ordenadas por valor.** Por data lê-se como um diário; por valor responde a "onde foi o dinheiro".
- **Custo por dia debaixo de cada barra.** É a única comparação justa entre um fim de semana e dez dias fora.
- **Gastos individuais por pessoa**, em baixo e discretos. São os únicos em que vocês divergem — o resto é partilhado por definição.

Sem gráficos de categorias: não tens categorias, e criá-las obrigaria a classificar cada despesa à mão. Se um dia quiseres esse corte, deriva-o do campo `comerciante`.

Todo o cálculo é feito no cliente sobre o cache local. Sem agregações no servidor, sem Cloud Functions.

## 8. Fases

**Fase 0 — Corpus (1 semana, passivo)**
App mínima que só regista notificações num ficheiro — com os extras completos e as flags da secção 4, não só título e texto. Instalas, vives a tua semana, e no fim tens os textos reais de Wallet, MB Way e Santander, incluindo casos que ninguém previu. Usa desde já o `applicationId` final: o upgrade para a app a sério preserva o acesso às notificações; um id diferente obrigava a dar a permissão outra vez nos dois telemóveis.

**Fase 1 — App utilizável (2–3 dias)**
Projeto Firebase, plugins `@capacitor-firebase`, regras, UI de eventos, registo manual, cálculo de saldo, sincronização. Zero automação. O passo que engana é o Google Sign-In: regista os fingerprints **SHA-1 e SHA-256 dos keystores de debug e de release** na consola Firebase antes de testar — é o meio dia clássico de `DEVELOPER_ERROR` para quem não o faz. **A partir daqui já a podes usar em viagem** — resolve o problema original, só com mais toques.

**Fase 2 — Captura (2 dias)**
Listener (com os filtros de resumo de grupo e reposts), parsers, deduplicação, notificação com ações. Sem fila offline para escrever: o SDK trata disso.

**Fase 3 — Afinação (1 dia)**
Caixa "Por tratar", lembrete diário, reembolsos, MB Way entre vocês como acerto automático.

**Fase 4 — Fecho (meio dia)**
Marcar acertado, arquivar, histórico.

Total: cerca de uma semana de trabalho efetivo, mais a semana passiva de recolha.

## 9. Distribuição

APK assinado, instalado à mão nos dois telemóveis. Grátis, mas cada atualização é reinstalar. Se isso te irritar depois de três vezes, a conta de developer são 25 € uma vez e o teste interno da Play Store trata das atualizações sozinho.

Em ambos os telemóveis, na primeira instalação:
1. Permitir acesso a notificações (Definições → Acesso a notificações) — é o que deixa o listener **ler** as dos bancos
2. Permitir que a app **publique** notificações (Android 13+, `POST_NOTIFICATIONS`) — permissão separada da anterior; sem ela a captura funciona mas a notificação de confirmação nunca aparece, e o fluxo todo parece morto
3. Excluir a app da otimização de bateria — **sem isto o Android mata o serviço** e a app fica cega sem avisar
4. Escolher quem é quem

## 10. Riscos

**O parser cala-se em silêncio.** Uma atualização do Santander muda uma palavra e deixas de capturar. Mitigação: alerta na app se passarem 7 dias sem qualquer captura automática durante um evento ativo.

**O serviço morre.** Fabricantes agressivos com bateria — Samsung é dos piores. Além da exclusão manual, vale um heartbeat: o serviço grava a última vez que esteve vivo **num documento no Firestore** (uma escrita por dia, custo zero), e a UI avisa se for há mais de 24 horas. No Firestore em vez de local por uma razão concreta: o telemóvel da Lisa com o listener morto é invisível para a Lisa — mas o Pedro abre a app e vê. Recuperação: `requestRebind()` no arranque e, em último caso, desligar e voltar a ligar o acesso a notificações nas definições.

**Falso positivo.** Uma notificação promocional com um valor lá dentro. Mitigação: exigir que o padrão bata certo com a estrutura completa, nunca capturar só por encontrar um número seguido de €.

---

## 11. Desenvolver com Claude Code

### Estrutura

```
contasbabe/
├── CLAUDE.md
├── docs/plano.md                    ← este ficheiro
├── src/                             ← React (UI via Capacitor)
│   ├── ecrans/
│   ├── dominio/
│   │   └── saldo.ts                 ← cálculo puro, sem Firestore
│   └── dados/firestore.ts           ← wrapper fino sobre @capacitor-firebase
├── nucleo/                          ← Kotlin JVM PURO, zero Android
│   ├── Dinheiro.kt                  ← gémeo de dominio/dinheiro.ts
│   ├── Notificacao.kt               ← a fronteira (pacote, título, texto)
│   ├── parsers/
│   │   ├── Parser.kt                ← interface comum
│   │   ├── SantanderParser.kt
│   │   ├── MbWayParser.kt
│   │   └── WalletParser.kt
│   ├── Dedup.kt
│   ├── Eventos.kt
│   └── src/test/                    ← testes dos parsers, em JUnit
├── android/app/src/main/java/pt/contasbabe/
│   ├── NotificationListener.kt      ← só cola; decide tudo no núcleo
│   ├── Repositorio.kt               ← Firestore a partir do nativo
│   ├── Notificacoes.kt              ← notificação com ações, lembrete
│   ├── ConfirmacaoReceiver.kt       ← responde aos botões da notificação
│   ├── Repostos.kt                  ← memória curta contra reposts
│   ├── Lembrete.kt                  ← alarme das 21h30
│   ├── ParserPlugin.kt              ← ponte para o ecrã de debug
│   └── debug/Coletor.kt             ← Fase 0
├── firestore.rules
└── firestore.indexes.json
```

**O núcleo é um módulo Gradle à parte, e isso é a decisão de estrutura que mais rende.** Sendo Kotlin JVM puro, sem uma única dependência Android, os parsers e a deduplicação compilam e testam em JUnit **sem SDK do Android e sem telemóvel** — um segundo por bateria completa. O `android/app` inclui-o com `include(':nucleo')`, e o `NotificationListener` limita-se a traduzir `StatusBarNotification` para `NotificacaoBruta(pacote, titulo, texto)` e a entregar.

A regra que daí sai: lógica vai para `nucleo/`; cola com o Android vai para `android/app`.

### CLAUDE.md

Vale mais do que qualquer prompt. Põe lá:

- O modelo de dados da secção 3, colado tal e qual
- Os textos reais das notificações — são a especificação do parser
- **Regra: nenhum parser se escreve sem um teste com o texto real como fixture.** É a única defesa contra regex escritas de cor.
- Valores monetários em cêntimos como inteiros, no schema e no cálculo — nunca em float
- Datas sempre em `Timestamp` do Firestore
- Todo o Firebase passa por `@capacitor-firebase/*` — o SDK web do Firebase nunca entra no projeto
- Um único processo Android; queries de deduplicação sempre com `Source.CACHE`
- O listener ignora resumos de grupo e reposts antes de qualquer parsing
- Na deduplicação, na dúvida cria-se — nunca engolir uma despesa
- A UI nunca calcula saldos — chama `dominio/saldo.ts`
- Nada de Cloud Functions, nada de Room, nada de camada de repositório

### Ordem de trabalho

Uma sessão por bloco, não tudo de uma vez.

**Fase 0** — `debug/Coletor.kt` e um ecrã que exporta o log. É a primeira coisa a instalar e a única que corre durante uma semana. Cinquenta linhas.

**Fase 1** — três sessões independentes:
1. `dominio/saldo.ts` com testes. Função pura, sem Firestore à volta. Escreve os testes primeiro, incluindo o teu exemplo dos 50/75, um caso com `soMinha` e um 60/40 com valor ímpar (o arredondamento da secção 6).
2. Firebase: projeto, fingerprints SHA, plugins `@capacitor-firebase`, regras, documento do casal na consola, `dados/firestore.ts`.
3. Ecrãs: lista de eventos, criar evento, registo manual, saldo.

**Fase 2** — depois de teres o corpus:
1. `parsers/` com testes contra os textos reais. Um parser de cada vez.
2. `NotificationListener.kt` (filtros de grupo/reposts) e `Dedup.kt`.
3. `ConfirmacaoReceiver.kt` com os botões de ação.

**Fase 3 e 4** — caixa "Por tratar", lembrete diário, fecho de evento, dashboard.

### Testar sem pagar cafés

O ponto que te vai poupar mais tempo: o listener recebe `StatusBarNotification`, mas o parser deve receber apenas `(pacote, titulo, texto)`. Com essa fronteira, testas o parser inteiro em JUnit com os textos guardados, sem telemóvel e sem gastar dinheiro.

Acrescenta também um ecrã de debug que injeta um texto à mão e mostra o que o parser extraiu. Quando o Santander mudar o formato, colas o texto novo e vês logo onde falha.
