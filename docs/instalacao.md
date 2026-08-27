# Instalação — do zero aos dois telemóveis

Windows sem nada instalado, até à app a capturar compras nos dois telemóveis.
Cerca de 2 horas de trabalho, mais uma semana de espera pelo meio que é parte do
plano e não um atraso (ver Fase 0).

Versão interactiva, com caixas para ir marcando:
<https://claude.ai/code/artifact/68d3f182-c799-41b6-a4b1-2032140ad6b7>

---

## Fase 1 — A máquina (~40 min)

### 1. Node.js

No PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```

Fecha e reabre o PowerShell — só assim o `node` aparece no PATH.

```powershell
node --version
```

**Tem de ser v22.12 ou superior**: o CLI do Capacitor exige o Node 22. Se o
winget instalou algo mais antigo, vai a <https://nodejs.org> e usa o instalador
do 22 LTS.

### 2. Git

```powershell
winget install Git.Git
```

Outra vez, fecha e reabre o PowerShell.

### 3. Android Studio

```powershell
winget install Google.AndroidStudio
```

Abre-o uma vez e deixa o assistente descarregar o SDK. Não é preciso instalar
Java à parte — o Android Studio traz o JDK.

### 4. Clonar o código

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/pedalexsilva/Gratinow.git ContasBabe
cd ContasBabe
git checkout claude/shared-expenses-plan-pjh2t3
```

Daqui para a frente, os comandos correm de dentro desta pasta salvo indicação
em contrário.

### 5. Instalar e verificar

```powershell
npm install
npm test
```

Esperado: **129 testes verdes**. E o núcleo Kotlin:

```powershell
cd nucleo
.\gradlew test
cd ..
```

Esperado: **88 testes**. A primeira vez demora, porque descarrega o Gradle.

Se estes testes passarem, a lógica toda está sã — saldos, parsers, deduplicação,
formatação de dinheiro. O que falta é ligar isto ao Firebase e ao telemóvel.

---

## Fase 2 — Firebase (~30 min)

### 6. Criar o projeto

<https://console.firebase.google.com> → **Criar projeto** → nome `ContasBabe`.
**Desliga o Google Analytics** — não é preciso e poupa dois ecrãs.

Fica no plano Spark: grátis, sem cartão.

### 7. Criar a base de dados

**Firestore Database** → **Criar base de dados**.

- Modo: **produção** (as regras vêm do repositório, no passo 13)
- Região: `europe-west1`

A região **não se pode mudar depois** — mudá-la obriga a criar outro projeto.

### 8. Ativar o login com Google

**Authentication** → **Começar** → **Google** → ativar. Email de suporte: o teu.

### 9. Registar a app Android

Definições do projeto → **Adicionar app** → Android.

- Nome do pacote: `pt.contasbabe` — **exatamente assim**
- SHA-1: deixa vazio, voltamos no passo 12

Descarrega o `google-services.json` para:

```
android\app\google-services.json
```

**Na pasta `android\app\`, não na raiz.** No sítio errado a app compila na mesma
e rebenta ao arrancar com `Default FirebaseApp is not initialized`. O ficheiro
está no `.gitignore` e não vai para o repositório.

---

## Fase 3 — Assinatura e primeira compilação (~30 min)

### 10. Preparar o web e sincronizar

```powershell
npm run build
npx cap sync android
```

Repete isto sempre que mexeres no código web.

### 11. Compilar e tirar as impressões digitais

```powershell
cd android
.\gradlew assembleDebug
.\gradlew signingReport
```

No fim, procura o bloco `Variant: debug` e copia o **SHA1** e o **SHA-256**.

Se falhar por falta do SDK: abre o Android Studio, `Open`, escolhe a pasta
`android` (não a raiz), deixa sincronizar, e volta ao PowerShell.

### 12. Registar as impressões digitais

Definições do projeto → Os teus apps → app Android → **Adicionar impressão
digital**. Cola o SHA-1; repete para o SHA-256. Depois **volta a descarregar o
`google-services.json`** e substitui o que lá está.

É este o passo que toda a gente esquece. Sem ele o login dá erro 10
(`DEVELOPER_ERROR`) sem explicação nenhuma.

### 13. Publicar as regras e os índices

```powershell
cd ..
npm install -g firebase-tools
firebase login
firebase use --add
firebase deploy --only firestore:rules,firestore:indexes
```

---

## Fase 4 — Instalar nos telemóveis (~20 min)

### 14. Gerar a APK

```powershell
cd android
.\gradlew assembleDebug
```

Fica em `android\app\build\outputs\apk\debug\app-debug.apk`.

### 15. Passar para os dois telemóveis

Drive, email ou cabo USB. No telemóvel: abrir o ficheiro → "Permitir desta
origem" → instalar.

**As atualizações têm de vir sempre desta máquina.** A APK está assinada com a
chave de debug deste computador; outra assinatura é recusada como atualização e
obriga a desinstalar primeiro, o que apaga o que ainda não sincronizou.

---

## Fase 5 — Ligar as duas contas (~10 min)

### 16. Cada um entra e copia o seu UID

Abrir a app → **Entrar com Google**. A app diz que a conta não pertence a nenhum
casal — é esperado — e **mostra o UID no ecrã**. Copia os dois, um de cada
telemóvel, e manda-os para ti próprio: são longos e não se escrevem à mão sem
erro.

### 17. Criar o documento do casal

Firestore Database → **Iniciar coleção**.

- ID da coleção: `casais`
- ID do documento: automático

Campos:

| Campo | Tipo | Valor |
|---|---|---|
| `membros` | array | dois *string*: o UID de cada um |
| `pessoas` | array | dois *map*, cada um com os três campos abaixo |
| → `id` | string | `pedro` · `lisa` |
| → `uid` | string | o UID dessa pessoa |
| → `nome` | string | `Pedro` · `Lisa` |

Os `id` são o que as percentagens de cada evento usam — escolhe-os agora e não
voltes a mexer.

É o único passo manual do sistema, e existe porque as regras de segurança
dependem dele: não há forma de a app o criar sozinha em segurança.

### 18. Reabrir a app nos dois telemóveis

Deve entrar direto no ecrã de saldo. Se ainda reclamar do casal, o UID está mal
copiado.

---

## Fase 6 — Permissões, em cada telemóvel (~5 min cada)

Dentro da app, o ecrã **⚙ Configuração** tem os três passos com o estado de cada
um e os botões que abrem as definições certas.

19. **Acesso a notificações** — é o que deixa a app *ler* as notificações do
    banco. Sem isto não se captura nada.
20. **Otimização de bateria** — sem a exclusão, os fabricantes mais agressivos
    matam o serviço em poucas horas.
21. **Permitir que a app notifique** — permissão *separada* da anterior, pedida
    no arranque. Sem ela a captura funciona e a confirmação nunca aparece.

Os dois primeiros falham em silêncio: não há erro, não há aviso, só despesas que
nunca aparecem.

---

## Fase 0 — A semana de recolha (7 dias)

Aqui pára-se. Esta parte é passiva e não se pode encurtar.

### 22. Usa a app, e paga como pagas sempre

Cria um evento e lança despesas à mão — já resolve o problema original, só com
mais toques. Entretanto o coletor regista **todas** as notificações do telemóvel
num ficheiro, haja evento ou não.

Durante a semana paga com Wallet, com MB Way e com o cartão físico. Quanto mais
variado, melhor o corpus.

Se alguma coisa for capturada automaticamente, é boa notícia: quer dizer que o
nome de pacote adivinhado estava certo. Se aparecer algo estranho em "Por
tratar", descarta — fica na mesma no corpus.

### 23. Ao fim da semana, exporta

**⚙ Configuração** → Corpus de notificações → **Exportar**, nos **dois**
telemóveis. Com o `corpus-notificacoes.jsonl` fecha-se o que falta:

- o parser da Google Wallet, hoje um stub deliberado
- confirmar ou corrigir os nomes de pacote do Santander e do MB Way
- a captura automática de estornos
- transferências MB Way entre vocês como acerto de contas

---

## Quando alguma coisa falha

| Sintoma | Causa quase certa | O que fazer |
|---|---|---|
| Login dá erro 10 / `DEVELOPER_ERROR` | Faltam as SHA na consola | Passo 12, e voltar a descarregar o `google-services.json` **depois** de as adicionar |
| App fecha logo ao abrir | `google-services.json` no sítio errado | Tem de estar em `android\app\`; depois `npx cap sync android` |
| "A conta não pertence a nenhum casal" | Documento do casal em falta, ou UID mal copiado | Passo 17. O erro no ecrã mostra o UID que a app usa |
| Não captura nada | Acesso a notificações desligado, nenhum evento ativo, ou nomes de pacote errados | ⚙ Configuração mostra o acesso. Sem evento ativo nada é gravado, de propósito. Se as duas estiverem bem, é a terceira — e é o que a Fase 0 resolve |
| Captura mas a confirmação nunca aparece | Permissão de notificações recusada | Passo 21. A despesa não se perde: fica em "Por tratar" |
| Funcionou uns dias e parou | O Android matou o serviço | ⚙ Configuração → bateria. O ecrã inicial avisa quando um telemóvel está calado há mais de 24 h |
| `npm test` ou `npx cap` falham | Node abaixo de 22.12 | `node --version`, passo 1 |
