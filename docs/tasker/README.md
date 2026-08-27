# Versão leve — Tasker + Google Sheets

Sem Android Studio, sem APK, sem Firebase. Cerca de **45 minutos** e está a
capturar despesas.

O parsing corre no Apps Script e não no telemóvel. É a diferença que mais conta
no dia a dia: quando o Santander mudar o texto de uma notificação, corriges numa
janela do browser e voltas a publicar — não há nada a recompilar nem a
reinstalar em telemóvel nenhum.

---

## O que se perde face à app nativa

Vale a pena saber antes de começar, não a meio.

| | App nativa | Tasker + Sheets |
|---|---|---|
| Instalação | ~2 h, Android Studio, Firebase | ~45 min |
| Corrigir um parser | recompilar e reinstalar nos dois | editar e publicar, 1 min |
| Nome dos pacotes | palpite, confirmado pelo corpus | escolhes a app numa lista |
| **Captura sem rede** | **grava e sincroniza sozinha** | **falha e perde-se** |
| Confirmar a despesa | botões na própria notificação | mudar o estado na folha |
| Só captura com evento a decorrer | sim | sim, mesma janela e mesma tolerância |
| Ver o saldo | ecrã próprio | fórmulas na folha |
| Custo | 0 € | Tasker, ~7 € uma vez |

O ponto do meio da tabela é o que mais dói: uma compra feita num hotel sem
Wi-Fi **não é gravada**. O `HTTP Request` do Tasker falha e a notificação
desaparece. Há mitigação (ver *Sobreviver sem rede*, no fim), mas dá trabalho e
não é automática como no SDK do Firestore.

Se isso for aceitável, esta versão ganha em tudo o resto.

**E há um bónus que não é pequeno:** cada notificação fica registada na folha
`Corpus`, reconhecida ou não. Ou seja, esta versão **é** a Fase 0 do plano. Ao
fim de uma semana tens os textos reais de todas as origens, e só então decides
se vale a pena construir a APK.

---

## 1. A folha (~5 min)

1. Vai a [sheets.new](https://sheets.new) e dá-lhe o nome **ContasBabe**.
2. Não precisas de criar colunas nem separadores — o script cria-os sozinho.

## 2. O script (~15 min)

3. Na folha: **Extensões → Apps Script**.
4. Apaga o que lá estiver e cola o conteúdo de [`Codigo.gs`](./Codigo.gs).
5. Na linha 23, troca `muda-isto-antes-de-publicar` por uma palavra qualquer que
   inventes. **Guarda-a**, vais precisar dela no Tasker.

   Sem isto, quem descobrir o URL da web app pode escrever na vossa folha.

6. Guarda (Ctrl+S).
7. No seletor de funções escolhe **`testarAqui`** e carrega em **Executar**.
   O Google vai pedir autorização — é a tua própria conta a autorizar o teu
   próprio script. Aceita.

   No registo deves ver as duas notificações de exemplo a serem reconhecidas, e
   a contagem de eventos a decorrer (zero, por agora). Se vires isso, o parsing
   funciona. E ficam criados os três separadores: **Despesas**, **Eventos** e
   **Corpus**.

### Sem evento a decorrer, não se cria despesa nenhuma

É a regra do plano, e vale a pena perceber porquê antes de estranhares.

Fora de viagem, cada ida ao supermercado e cada café criariam uma linha
pendente que ninguém pediu — ao fim de um ano são centenas de linhas para
apagar à mão. Por isso só se grava uma despesa quando há um evento a decorrer.

O que **não** depende disto é o separador **Corpus**: aí fica tudo, sempre,
haja evento ou não, seja reconhecido ou não. É o que faz esta versão servir
como Fase 0 desde o primeiro dia.

8. Vai ao separador **Eventos** e escreve a primeira linha:

   | Nome | Início | Fim (inclusive) | % da 1ª pessoa | Fechado |
   |---|---|---|---|---|
   | Alentejo | 08/05/2026 | 12/05/2026 | 50 | |

   - **O fim conta o dia inteiro.** "8 a 12" inclui o dia 12 até à
     meia-noite — não precisas de pôr 13.
   - A captura continua ligada **até três dias depois do fim**, porque os
     reembolsos e os acertos de pré-autorização chegam depois de a viagem
     acabar.
   - *Fechado*: escreve `sim` quando acertarem as contas. Um evento fechado
     deixa de capturar.

   Com **um** evento a decorrer, a coluna *Evento* de cada despesa vem
   pré-preenchida. Com **vários**, vem vazia — escolher por ti seria adivinhar.
   Em qualquer dos casos o *Estado* fica `pendente` e só entra no saldo depois
   de confirmares.

   Se preferires capturar tudo o ano inteiro, põe `EXIGIR_EVENTO_ATIVO = false`
   na linha 39 do script.

9. **Implementar → Nova implementação** → engrenagem → **App Web**:
   - Descrição: `ContasBabe`
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - **Implementar** → copia o **URL da app Web** (acaba em `/exec`)

10. Abre esse URL no browser. Deve responder:

    ```json
    {"ok":true,"servico":"ContasBabe","exigeEventoAtivo":true,"eventosAtivos":["Alentejo"]}
    ```

    Serve de diagnóstico a qualquer momento: se `eventosAtivos` vier vazio, o
    script não vai criar despesas nenhumas, e diz-te isso no campo `aviso`.

> Sempre que mexeres no script tens de fazer **Implementar → Gerir
> implementações → editar → Versão: Nova versão**. Guardar não chega — é o erro
> clássico do Apps Script.

## 3. O Tasker (~20 min, em cada telemóvel)

11. Instala o **Tasker** da Play Store.
12. Dá-lhe acesso a notificações: no Tasker, **⋮ → Mais → Android Settings →
    Notification Access** → liga o Tasker.
13. Exclui o Tasker da otimização de bateria. Sem isto o Android mata-o, tal
    como mataria o serviço da app nativa.

### Um perfil por origem

Faz-se três vezes — Wallet, MB Way e Santander — e é de propósito: assim o
`pacote` que chega ao servidor é uma etiqueta que **tu** controlas, e não algo
que o Tasker tenha de adivinhar. O problema dos nomes de pacote desaparece.

14. **+ → Perfil → Evento → UI → Notificação**
    - **App**: escolhe da lista (Google Wallet, ou MB Way, ou Santander)
    - Deixa o resto vazio
15. Ao sair, o Tasker pede uma tarefa. Cria uma nova, com o nome da origem.

16. **Antes do HTTP, vê o que o Tasker te dá.** Adiciona uma ação
    **Alerta → Flash**, e no texto usa o botão de variáveis (a etiqueta ⊞) para
    inserir as variáveis da notificação — os nomes mudam entre versões do
    Tasker. Guarda, faz uma compra pequena, e vê o que aparece no ecrã.

    Anota qual delas traz o **título** e qual traz o **texto**.

17. Apaga o Flash e põe **Rede → Pedido HTTP**:
    - **Método**: `POST`
    - **URL**: o teu URL `/exec`
    - **Cabeçalhos**: `Content-Type:application/json`
    - **Corpo**:

    ```json
    {
      "segredo": "A-TUA-PALAVRA",
      "pessoa": "pedro",
      "pacote": "pt.sibs.android.mbway",
      "titulo": "%ntitle",
      "texto": "%ntext",
      "quando": "%TIMES"
    }
    ```

    Substitui:
    - `A-TUA-PALAVRA` pelo segredo do passo 5
    - `pedro` por `lisa` no outro telemóvel — é isto que diz quem pagou
    - `%ntitle` e `%ntext` pelas variáveis que descobriste no passo 16
    - `pacote` conforme o perfil:

      | Perfil | `pacote` |
      |---|---|
      | Google Wallet | `com.google.android.apps.walletnfcrel` |
      | MB Way | `pt.sibs.android.mbway` |
      | Santander | `pt.santandertotta.mobileapp` |

18. Repete os passos 14–17 para as outras duas origens.
19. Repete tudo no segundo telemóvel, com `"pessoa": "lisa"`.

    (Podes exportar o perfil no primeiro telemóvel — carregar longamente no
    nome → **Exportar** — e importá-lo no segundo, mudando só a `pessoa`.)

---

## 4. Usar

Paga um café. Em segundos deve aparecer uma linha na folha **Despesas**, com
`Estado = pendente` e — se só houver um evento a decorrer — a coluna *Evento*
já preenchida.

**Para tratar a despesa**, muda *Estado* para `confirmada`. Se o evento vier
vazio (porque tens vários a decorrer), escreve-o primeiro. Ou põe `descartada`,
se não for da viagem.

> **Se não aparecer nada nas Despesas**, vai ao separador **Corpus** e olha para
> a coluna *Resultado*. Ela diz exatamente o que aconteceu a cada notificação:
> `despesa criada`, `duplicado descartado`, `enriqueceu a linha N`,
> `sem evento ativo` ou `não reconhecido`. É o primeiro sítio a olhar, sempre.

> **Não apagues as linhas descartadas.** A deduplicação olha para elas: se
> apagares a captura do MB Way, a do Santander que chegou 45 segundos depois
> deixa de encontrar par e renasce como despesa a dobrar.

Para não escrever à mão de cada vez, seleciona as colunas *Evento* e *Estado* e
usa **Dados → Validação de dados → Lista de itens**, com os teus eventos e com
`pendente, confirmada, descartada`.

### O saldo

Cria um separador **Saldo**. Na coluna A escreve as etiquetas, e na coluna B
cola isto (a percentagem vem da folha *Eventos*, para não haver dois sítios a
dizer coisas diferentes):

| | A | B |
|---|---|---|
| 1 | Evento | `Alentejo` |
| 2 | % do Pedro | `=VLOOKUP($B$1;Eventos!A:D;4;FALSO)` |
| 3 | | |
| 4 | Pedro pagou | `=SUMIFS(Despesas!C:C;Despesas!B:B;"pedro";Despesas!J:J;$B$1;Despesas!K:K;"confirmada")/100` |
| 5 | Pedro só dele | `=SUMIFS(Despesas!C:C;Despesas!B:B;"pedro";Despesas!J:J;$B$1;Despesas!K:K;"confirmada";Despesas!I:I;VERDADEIRO)/100` |
| 6 | Lisa pagou | `=SUMIFS(Despesas!C:C;Despesas!B:B;"lisa";Despesas!J:J;$B$1;Despesas!K:K;"confirmada")/100` |
| 7 | Lisa só dela | `=SUMIFS(Despesas!C:C;Despesas!B:B;"lisa";Despesas!J:J;$B$1;Despesas!K:K;"confirmada";Despesas!I:I;VERDADEIRO)/100` |
| 8 | | |
| 9 | Comum | `=(B4-B5)+(B6-B7)` |
| 10 | Pedro devia | `=ARRED(B9*B2/100;2)` |
| 11 | **Saldo do Pedro** | `=(B4-B5)-B10` |

Positivo, tem a receber. Negativo, deve. Muda `B1` para ver outro evento.

Repara que só entram as linhas com `Estado = confirmada`: uma despesa `pendente`
não mexe no saldo, e uma `descartada` também não — mas continua lá para a
deduplicação a ver.

### Registar à mão

Escreve uma linha nova: *Quando*, *Pagou*, *Cêntimos* (**em cêntimos**: `1250`
para 12,50 €), *Origem* = `manual`, *Evento*, *Estado* = `confirmada`.

A coluna *Valor* é só apresentação — põe lá `=C<linha>/100`.

Se pagaste com cartão, a notificação do Santander que chegar a seguir é
descartada automaticamente: o script vê que já lá está a mesma quantia, do mesmo
pagador, dentro de três minutos.

---

## Sobreviver sem rede

Uma compra sem rede perde-se. Se isso te incomodar, a mitigação no Tasker é:

1. Na tarefa, a seguir ao **Pedido HTTP**, uma ação **Se `%http_response_code`
   não corresponde a `200`** → **Ficheiro → Escrever ficheiro**, acrescentando o
   JSON a um ficheiro de pendentes.
2. Um segundo perfil, **Estado → Rede → Wi-Fi ligado**, que lê esse ficheiro,
   reenvia cada linha, e apaga o ficheiro se correr bem.

São mais umas seis ações. É exatamente esta fila que o SDK do Firestore te dá de
borla na versão nativa — e foi a razão principal para o plano original ter
escolhido o Firestore.

---

## Quando alguma coisa falha

Antes de tudo: **abre o separador `Corpus` e vê a coluna *Resultado***. Ela
responde à maior parte destas perguntas sozinha.

| Sintoma | Causa quase certa | O que fazer |
|---|---|---|
| Nada chega a folha nenhuma | O Tasker não tem acesso a notificações | Passo 12 |
| `Corpus` diz `sem evento ativo` | Não há nenhuma linha em *Eventos* cujas datas incluam hoje | Passo 8. Abre o URL `/exec` para ver o que o script considera ativo |
| `Corpus` diz `não reconhecido` | O texto não bate certo com o parser, ou é a Wallet (que ainda é um stub) | Manda-me a linha do `Corpus` |
| Uma despesa apareceu sem evento | Tens vários eventos a decorrer ao mesmo tempo | É de propósito: escolher por ti seria adivinhar. Escreve o evento à mão |
| `{"ok":false,"erro":"segredo errado"}` | O segredo do Tasker não é o do script | Passos 5 e 16 |
| Mudaste o script e nada mudou | Guardar não publica | **Implementar → Gerir implementações → editar → Nova versão** |
| Aparece tudo a dobrar | As duas notificações não estão a ser vistas como par | Confirma que a coluna *Pagou* é igual nas duas e que os cêntimos batem certo |
| Parou de capturar ao fim de uns dias | O Android matou o Tasker | Otimização de bateria, passo 12 |

---

## Se um dia quiseres a app nativa

O código está todo escrito e testado neste repositório — ver
[`../instalacao.md`](../instalacao.md). E o `Corpus` que esta versão recolheu é
exatamente o que falta para fechar os parsers da Wallet, os estornos e as
transferências.

Uma coisa não se herda: as despesas que já estiverem na folha não passam para o
Firestore sozinhas.
