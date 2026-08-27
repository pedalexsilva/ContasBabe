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
│  Firestore                               │
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

## 3. Schema

Tudo debaixo de um documento partilhado, para as regras de segurança serem triviais.

```
/casais/{casalId}
    pessoas: [
      { id: "pedro", nome: "Pedro" },
      { id: "lisa",  nome: "Lisa"  }
    ]

/casais/{casalId}/eventos/{eventoId}
    nome:          "Alentejo"
    inicio:        timestamp
    fim:           timestamp
    percPedro:     50.0
    fechadoEm:     timestamp | null
    acertadoValor: number | null

/casais/{casalId}/despesas/{despesaId}
    eventoId:    string | null      // null = caixa "Por tratar"
    pagouId:     "pedro" | "lisa"
    valor:       number             // negativo = reembolso
    descricao:   string | null
    comerciante: string | null
    soMinha:     boolean
    origem:      "wallet" | "mbway" | "santander" | "manual"
    cartaoLast4: string | null
    rawText:     string | null
    ocorreuEm:   timestamp
    tratada:     boolean
```

Notas:

- `eventoId` nulo = está na caixa "Por tratar"
- `tratada: false` = capturada mas ainda sem confirmação tua
- `rawText` parece supérfluo até o Santander mudar o texto de uma notificação. Aí é o que te permite reparar o parser sem repetir os testes.
- `valor` negativo cobre os reembolsos que viste no histórico da Wallet
- Datas em `Timestamp` do Firestore, nunca em string — precisas de ordenar e de fazer intervalos

### Autenticação e regras

Google Sign-In, e os dois UIDs ficam gravados no documento do casal:

```javascript
match /casais/{casalId} {
  allow read, write: if request.auth.uid in resource.data.membros;

  match /{documento=**} {
    allow read, write: if request.auth.uid in
      get(/databases/$(database)/documents/casais/$(casalId)).data.membros;
  }
}
```

### Índices

Um composto, para a lista de despesas de um evento por ordem cronológica: `eventoId` ascendente + `ocorreuEm` descendente.

A deduplicação **não precisa de índice** — corre contra o cache local, sobre as despesas dos últimos minutos, que estão sempre em memória. Zero leituras faturadas e funciona offline.

### Custo

O plano Spark dá 50 000 leituras e 20 000 escritas por dia. Uma viagem de uma semana gera talvez 40 escritas. Não há cenário realista em que isto saia do free tier.

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

O normalizador de valores tem de aceitar `0,95`, `0.95`, `EUR 0,95` e `0.95€`. Uma função só, testada contra os três formatos.

### Identificação das origens

Não confies em nomes de package que eu ou qualquer outra fonte te dê — confirma-os no teu telemóvel. Constrói primeiro um **modo de captura**: o listener regista `packageName`, título, texto e timestamp de tudo, e escreve num ficheiro. Uma semana de uso normal dá-te o corpus e os identificadores certos de uma vez.

### Deduplicação

Quando chega uma notificação, antes de criar despesa:

```
existe = procurar despesa com
   valor igual
   ocorreu_em dentro de ±3 minutos
   mesmo pagador

se existe e a nova origem é 'santander' → descartar
se existe e a nova origem é primária    → atualizar a existente com o comerciante
se não existe                            → criar
```

Mediste 45 segundos entre MB Way e Santander. Três minutos dá margem para redes más sem risco realista de colisão.

Consequência útil: uma notificação do Santander que **não** encontre par é quase de certeza uma compra online que nenhuma primária apanhou. Essa cria despesa e pede-te descrição, porque não traz comerciante.

## 5. Fluxo de confirmação

Notificação nativa com ações:

```
Café Orfeu — 0,95 €
[Alentejo]  [Não é da viagem]  [Outro evento]
```

- Um evento ativo → botão direto com o nome dele
- Vários ativos → o primeiro botão abre a lista
- Nenhum ativo → não notifica de todo, e nem sequer grava

"Não é da viagem" descarta em definitivo. Sem confirmação, cai em "Por tratar" com `tratada = false`.

**Lembrete diário** às 21h30, se houver pendentes: uma notificação, ecrã de lista, atribuis tudo de seguida.

## 6. Cálculo do saldo

```
Para cada pessoa:
  pagou       = soma de todas as despesas dela no evento
  pessoais    = soma das despesas dela marcadas so_minha
  contribuiu  = pagou - pessoais

comum = contribuiu_A + contribuiu_B
devia_A = comum × (perc_A / 100)
devia_B = comum - devia_A

saldo_A = contribuiu_A - devia_A
```

Positivo = tem a receber. Exemplo teu: 50 e 75, a 50/50 → comum 125, cada um devia 62,50 → Pedro −12,50, ou seja deve 12,50 € à Lisa.

Reembolsos entram como valor negativo e o cálculo não muda.

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
App mínima que só regista notificações num ficheiro. Instalas, vives a tua semana, e no fim tens os textos reais de Wallet, MB Way e Santander, incluindo casos que ninguém previu.

**Fase 1 — App utilizável (2 dias)**
Projeto Firebase, regras, UI de eventos, registo manual, cálculo de saldo, sincronização. Zero automação. **A partir daqui já a podes usar em viagem** — resolve o problema original, só com mais toques.

**Fase 2 — Captura (2 dias)**
Listener, parsers, deduplicação, notificação com ações. Sem fila offline para escrever: o SDK trata disso.

**Fase 3 — Afinação (1 dia)**
Caixa "Por tratar", lembrete diário, reembolsos, MB Way entre vocês como acerto automático.

**Fase 4 — Fecho (meio dia)**
Marcar acertado, arquivar, histórico.

Total: cerca de uma semana de trabalho efetivo, mais a semana passiva de recolha.

## 9. Distribuição

APK assinado, instalado à mão nos dois telemóveis. Grátis, mas cada atualização é reinstalar. Se isso te irritar depois de três vezes, a conta de developer são 25 € uma vez e o teste interno da Play Store trata das atualizações sozinho.

Em ambos os telemóveis, na primeira instalação:
1. Permitir acesso a notificações (Definições → Acesso a notificações)
2. Excluir a app da otimização de bateria — **sem isto o Android mata o serviço** e a app fica cega sem avisar
3. Escolher quem é quem

## 10. Riscos

**O parser cala-se em silêncio.** Uma atualização do Santander muda uma palavra e deixas de capturar. Mitigação: alerta na app se passarem 7 dias sem qualquer captura automática durante um evento ativo.

**O serviço morre.** Fabricantes agressivos com bateria — Samsung é dos piores. Além da exclusão manual, vale um heartbeat: o serviço regista a última vez que esteve vivo, e a UI avisa se for há mais de 24 horas.

**Falso positivo.** Uma notificação promocional com um valor lá dentro. Mitigação: exigir que o padrão bata certo com a estrutura completa, nunca capturar só por encontrar um número seguido de €.

---

## 11. Desenvolver com Claude Code

### Estrutura

```
despesas/
├── CLAUDE.md
├── docs/plano.md                    ← este ficheiro
├── src/                             ← React (UI via Capacitor)
│   ├── ecrans/
│   ├── dominio/
│   │   └── saldo.ts                 ← cálculo puro, sem Firestore
│   └── dados/firestore.ts
├── android/app/src/main/java/pt/despesas/
│   ├── NotificationListener.kt
│   ├── parsers/
│   │   ├── Parser.kt                ← interface comum
│   │   ├── SantanderParser.kt
│   │   ├── MbWayParser.kt
│   │   └── WalletParser.kt
│   ├── Dedup.kt
│   ├── ConfirmacaoReceiver.kt       ← responde aos botões da notificação
│   └── debug/Coletor.kt             ← Fase 0
├── android/app/src/test/             ← testes dos parsers
├── firestore.rules
└── firestore.indexes.json
```

### CLAUDE.md

Vale mais do que qualquer prompt. Põe lá:

- O modelo de dados da secção 3, colado tal e qual
- Os textos reais das notificações — são a especificação do parser
- **Regra: nenhum parser se escreve sem um teste com o texto real como fixture.** É a única defesa contra regex escritas de cor.
- Valores monetários em cêntimos como inteiros no cálculo, nunca em float
- Datas sempre em `Timestamp` do Firestore
- A UI nunca calcula saldos — chama `dominio/saldo.ts`
- Nada de Cloud Functions, nada de Room, nada de camada de repositório

### Ordem de trabalho

Uma sessão por bloco, não tudo de uma vez.

**Fase 0** — `debug/Coletor.kt` e um ecrã que exporta o log. É a primeira coisa a instalar e a única que corre durante uma semana. Cinquenta linhas.

**Fase 1** — três sessões independentes:
1. `dominio/saldo.ts` com testes. Função pura, sem Firestore à volta. Escreve os testes primeiro, incluindo o teu exemplo dos 50/75 e um caso com `soMinha`.
2. Firestore: projeto, regras, `dados/firestore.ts`.
3. Ecrãs: lista de eventos, criar evento, registo manual, saldo.

**Fase 2** — depois de teres o corpus:
1. `parsers/` com testes contra os textos reais. Um parser de cada vez.
2. `NotificationListener.kt` e `Dedup.kt`.
3. `ConfirmacaoReceiver.kt` com os botões de ação.

**Fase 3 e 4** — caixa "Por tratar", lembrete diário, fecho de evento, dashboard.

### Testar sem pagar cafés

O ponto que te vai poupar mais tempo: o listener recebe `StatusBarNotification`, mas o parser deve receber apenas `(pacote, titulo, texto)`. Com essa fronteira, testas o parser inteiro em JUnit com os textos guardados, sem telemóvel e sem gastar dinheiro.

Acrescenta também um ecrã de debug que injeta um texto à mão e mostra o que o parser extraiu. Quando o Santander mudar o formato, colas o texto novo e vês logo onde falha.
