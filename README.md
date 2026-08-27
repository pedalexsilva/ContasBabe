# ContasBabe

App de **despesas partilhadas a dois**: registar quem pagou o quê, saber quanto
cada um deve e acertar contas sem discussões — com as compras a serem capturadas
automaticamente a partir das notificações do telemóvel.

## Como funciona

Cria-se um **evento** (uma viagem, um fim de semana, um período com princípio e
fim) e escolhe-se a divisão, 50/50 por omissão. A partir daí, cada compra paga
com o telemóvel gera uma notificação do banco, e a app apanha-a: mostra
*"Café Orfeu — 0,95 €"* com os botões para a atribuir ao evento ou descartar. O
que ficar por confirmar cai numa caixa **"Por tratar"**, e há um lembrete às
21h30 se lá ficar alguma coisa.

No fim, o saldo diz quem deve a quem. Um dos dois marca como acertado e o evento
fica no histórico.

Também dá para registar despesas à mão — e é assim que a app funciona sem
automação nenhuma, se preferires.

## Estado

**Utilizável já, com registo manual. A automação espera pela Fase 0** — a
semana passiva de recolha de notificações reais.

Sem esse corpus ficam três coisas por fazer, todas pela mesma razão (o projeto
tem por regra que nenhum parser se escreve sem um teste com o texto real como
fixture): o parser da Google Wallet, a captura automática de estornos, e tratar
uma transferência MB Way entre vocês como acerto de contas. Os nomes de pacote
do Santander e do MB Way também são palpites por confirmar — mudam num sítio só,
o `PACOTE` de cada parser.

O que está pronto e verificado:

| | |
|---|---|
| Domínio e ecrãs TypeScript | 129 testes |
| Núcleo Kotlin (parsers, dedup) | 80 testes |
| Regras e índices do Firestore | escritos |
| App Android (serviço, notificações) | escrita, **por compilar** |

A app Android não foi compilada: o ambiente onde foi desenvolvida não tem acesso
ao SDK do Android. Toda a *lógica* — parsers, deduplicação, valores monetários —
vive no módulo `nucleo/`, que é Kotlin puro e **está** compilado e testado. O que
falta verificar é a cola com o Android.

## Arquitetura

```
Kotlin nativo (sempre vivo)   NotificationListenerService, parsers, dedup
        ↓ escreve
Firestore                     cache offline, listeners em tempo real
        ↓ lê
UI React (Capacitor)          eventos, saldos, histórico, registo manual
```

O núcleo é nativo porque o serviço corre com a app fechada e a notificação de
confirmação tem de ser publicada e respondida sem acordar uma WebView. O
Firestore está lá pela cache offline: uma despesa capturada num hotel sem Wi-Fi
fica gravada e sobe sozinha depois, o que poupa uma camada local inteira.

## Arrancar

```bash
npm install
npm test          # domínio, conversores e ecrãs
npm run dev       # UI no browser (sem captura de notificações)

cd nucleo && ./gradlew test    # parsers e deduplicação (só precisa de um JDK)
```

Para a APK é preciso o Android SDK:

```bash
npm run build && npx cap sync android
# depois abrir android/ no Android Studio, ou ./gradlew assembleDebug
```

### Antes da primeira APK

1. Criar o projeto Firebase e pôr o `google-services.json` em `android/app/`
   (está no `.gitignore` — não vai para o repositório).
2. Registar os fingerprints **SHA-1 e SHA-256** dos keystores de debug **e** de
   release na consola. Sem isto o Google Sign-In dá `DEVELOPER_ERROR`.
3. Criar à mão, na consola, o documento `/casais/{qualquer-id}` com os dois UIDs
   em `membros` e as duas pessoas em `pessoas`. É o único passo manual, e existe
   porque as regras de segurança dependem dele.
4. `firebase deploy --only firestore:rules,firestore:indexes`

### Em cada telemóvel

O ecrã de **Configuração** dentro da app tem os três passos com o estado de cada
um, e os botões que abrem as definições certas. Os dois primeiros falham em
silêncio se ficarem por fazer:

1. **Acesso a notificações** — sem isto não se captura nada.
2. **Excluir da otimização de bateria** — sem isto o Android mata o serviço.
3. Confirmar quem é quem.

## Documentação

- `docs/plano.md` — o plano completo: decisões, schema, parsing, riscos, fases.
- `CLAUDE.md` — regras do projeto e as armadilhas do Android que já custaram
  tempo.
