# ContasBabe

App de despesas partilhadas a dois, com captura automática por notificações
Android. O plano completo está em `docs/plano.md` — este ficheiro é o resumo
operacional para quem (ou o quê) mexer no código.

## Regras que não se negoceiam

- **Dinheiro em cêntimos inteiros**, no schema e no cálculo. Nunca float, nunca
  euros. Um `valorCent: 0.95` é um bug, não um arredondamento — as regras do
  Firestore recusam-no e os conversores fazem `throw`.
- **Datas em `Timestamp` do Firestore**, nunca em string. Uma string ordena por
  texto e estraga intervalos.
- **Nenhum parser se escreve sem um teste com o texto real como fixture.** É a
  única defesa contra regex escritas de cor. O `WalletParser` é um stub
  deliberado à espera do corpus — não inventar uma regex para ele.
- **A UI nunca calcula saldos.** Chama `dominio/saldo.ts`. Há um teste em
  `src/arquitetura.test.ts` que falha se alguém escrever um `reduce` sobre
  `valorCent` dentro de `src/ecrans/`.
- **O SDK web do Firebase não entra no código.** Tudo passa por
  `@capacitor-firebase/*`, que faz ponte para o SDK nativo. Também com teste
  a garantir.
- **Nada de Cloud Functions, nada de Room, nada de camada de repositório.**

## Porque é que o SDK tem de ser o nativo

Três razões, e nenhuma é estética:

1. O Google bloqueia OAuth dentro de WebViews embebidas
   (`disallowed_useragent`). Com o SDK web, o login nunca funcionaria.
2. O SDK web teria a cache offline dele em IndexedDB, separada da cache nativa
   que o `NotificationListenerService` usa. Uma despesa capturada sem rede não
   apareceria na UI do próprio telemóvel até haver rede.
3. O serviço em Kotlin escreve autenticado como o utilizador do SDK nativo. Com
   a sessão só no JavaScript, escrevia anónimo e as regras rejeitavam tudo em
   silêncio.

Corolário: **um único processo Android**. Nunca `android:process` no manifest —
dividia a cache e a sessão em dois.

## Estrutura

```
src/                          UI React, servida pelo Capacitor
  tipos.ts                    modelo de dados, espelha o schema Firestore
  dominio/                    funções puras: sem Firestore, sem React
    dinheiro.ts               cêntimos <-> texto (gémeo de nucleo/Dinheiro.kt)
    saldo.ts                  o cálculo. A UI chama daqui e mais nada.
    eventos.ts                janela ativa, sugestões, duração
    dashboard.ts              resumo anual
    saude.ts                  alertas de serviço morto e parser mudo
    datas.ts                  formatação e leitura de datas
  dados/                      fronteira com o Firestore
    conversores.ts            documento <-> domínio, com validação
    firestore.ts              leituras, escritas, listeners
    auth.ts                   Google Sign-In nativo
    parserNativo.ts           ponte para o parser Kotlin (ecrã de debug)
  ecrans/                     um ficheiro por ecrã
  estado.tsx                  uma subscrição por coleção, resto derivado

nucleo/                       Kotlin JVM PURO — zero dependências Android
  Dinheiro.kt                 gémeo de dominio/dinheiro.ts
  Notificacao.kt              a fronteira (pacote, título, texto)
  parsers/                    Santander, MB Way, Wallet (stub)
  Dedup.kt                    decisão pura de deduplicação
  Eventos.kt                  janela ativa

android/app/src/main/java/pt/contasbabe/
  NotificationListener.kt     o serviço sempre vivo. Só cola.
  Repositorio.kt              Firestore a partir do nativo
  Notificacoes.kt             notificação de confirmação e lembrete
  ConfirmacaoReceiver.kt      botões da notificação
  Repostos.kt                 memória curta contra reposts
  Lembrete.kt                 alarme das 21h30
  ParserPlugin.kt             ponte Capacitor para o ecrã de debug
  debug/Coletor.kt            Fase 0: regista tudo num ficheiro
```

### Porque é que o núcleo é um módulo à parte

Porque assim **compila e testa sem Android SDK**. Os parsers, a deduplicação e
o normalizador de valores correm em JUnit num segundo, sem telemóvel e sem
gastar dinheiro em cafés. O `android/app` depende dele (`:nucleo` em
`settings.gradle`); o `NotificationListener` só traduz `StatusBarNotification`
para `NotificacaoBruta(pacote, titulo, texto)` e entrega.

Se acrescentares lógica, ela vai para `nucleo/`. Se for cola com o Android, vai
para `android/app`.

## Comandos

```bash
npm test                    # 128 testes: domínio, conversores, ecrãs, arquitetura
npm run typecheck
npm run build

cd nucleo && gradle test    # 80 testes: parsers, dedup, dinheiro

npx cap sync android        # depois de mudar o web ou os plugins
```

O `dinheiro.ts` e o `Dinheiro.kt` são a mesma função em duas linguagens. **Se
mudares uma regra num, muda no outro e nos dois testes.** Uma divergência aqui
faz a app mostrar um valor e gravar outro.

## Schema

Ver `docs/plano.md` secção 3. Em resumo:

```
/casais/{casalId}
    membros:  ["uid-pedro", "uid-lisa"]     <- as regras dependem disto
    pessoas:  [{ id, uid, nome }, ...]

/casais/{casalId}/eventos/{eventoId}
    nome, inicio, fim, percentagens: { pedro: 50, lisa: 50 },
    fechadoEm, acertadoCent

/casais/{casalId}/despesas/{despesaId}
    eventoId, pagouId, valorCent, descricao, comerciante, soMinha,
    origem, cartaoLast4, rawText, ocorreuEm,
    estado: "pendente" | "confirmada" | "descartada"

/casais/{casalId}/heartbeats/{pessoaId}
    vistoEm, ultimaCapturaEm
```

Notas que custaram a chegar lá:

- `estado` em vez de um booleano `tratada`, e **descartar não apaga**. O
  `rawText` continua no corpus, e a janela de deduplicação continua a ver o par:
  sem isso, descartar a captura do MB Way deixava a do Santander, 45 segundos
  depois, renascer como despesa.
- `eventoId` só se preenche na confirmação. A sugestão da caixa "Por tratar"
  calcula-se da data, não se guarda.
- `percentagens` é um mapa por pessoa, não um `percPedro`: não depende da ordem
  do array `pessoas` nem do nome de ninguém.

## Textos reais das notificações

São a especificação dos parsers. Estão como fixtures em
`nucleo/src/test/kotlin/.../parsers/`.

**Santander**
```
Título: Santander
Corpo:  Movimento no valor de EUR 0,95 no cartão ***********0390
```
Vírgula decimal, sem comerciante, dá o last4. As notificações de 3D Secure
descartam-se: pedem autorização de uma compra que ainda não aconteceu.

**MB Way**
```
Título: Compra QRCode
Corpo:  Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.
```
Ponto decimal, dá comerciante. O nome do comerciante pode ter vírgulas — a
âncora é `, no valor de`, não a primeira vírgula.

**Wallet** — por recolher. Ver Fase 0.

Os nomes de pacote (`pt.santandertotta.mobileapp`, `pt.sibs.android.mbway`,
`com.google.android.apps.walletnfcrel`) são **palpites por confirmar** com o
corpus. Mudam num sítio só: o `PACOTE` de cada parser.

## Deduplicação

Três camadas, de fora para dentro:

1. **No listener**: ignorar resumos de grupo (`FLAG_GROUP_SUMMARY`) e reposts
   (`Repostos.kt`). São a mesma notificação a chegar duas vezes.
2. **No núcleo** (`Dedup.kt`): duas notificações diferentes sobre a mesma
   compra. Par = mesmo valor, mesmo pagador, ±3 minutos.
3. **Na dúvida, criar.** Um duplicado apaga-se num toque; uma despesa engolida
   pela deduplicação nunca mais aparece.

Duas capturas da mesma origem primária dentro da janela **criam as duas** — são
dois cafés iguais em rondas seguidas, não um duplicado.

## Armadilhas do Android que já custaram tempo

- **Trampoline**: desde o Android 12 um `BroadcastReceiver` não pode abrir uma
  Activity. O botão que abre a lista tem de ser `PendingIntent.getActivity`, e
  chega à UI pelo esquema `contasbabe://por-tratar`.
- **`POST_NOTIFICATIONS`** (Android 13+) é uma permissão *separada* do acesso a
  notificações. Sem ela, a captura funciona e a confirmação nunca aparece — o
  fluxo parece morto sem dar erro.
- **Escritas nunca se esperam.** O `Task` de uma escrita só completa quando o
  servidor confirma; offline, nunca. O SDK grava no cache primeiro, e é isso que
  faz a captura no hotel sem Wi-Fi funcionar.
- **Leituras com `Source.CACHE` explícito.** Sem isso, com rede, a query vai ao
  servidor e é faturada.
- **`exported="true"` no serviço** é mesmo necessário: quem liga é o
  system_server, e é a permissão `BIND_NOTIFICATION_LISTENER_SERVICE` que
  impede toda a gente de o fazer.
- **Fingerprints SHA-1 e SHA-256** dos keystores de debug **e** de release na
  consola Firebase, antes de testar o login. É o `DEVELOPER_ERROR` clássico.

## Formatação

`Intl.NumberFormat` está proibido para dinheiro e datas. O pt-PT do CLDR usa
*narrow no-break space* nos milhares e o resultado muda com os dados ICU do
runtime — o mesmo saldo aparecia diferente em cada telemóvel. Formata-se à mão,
em `dominio/dinheiro.ts` e `dominio/datas.ts`.
