# Versão leve — Tasker + Google Sheets

Sem Android Studio, sem APK, sem Firebase. Cerca de **45 minutos** e está a
capturar despesas.

O parsing corre no Apps Script e não no telemóvel. É a diferença que mais conta
no dia a dia: quando o Santander mudar o texto de uma notificação, corriges numa
janela do browser e voltas a publicar — não há nada a recompilar nem a
reinstalar em telemóvel nenhum.

> **Versão interactiva do guia do Tasker**, com caixas para ir marcando:
> <https://claude.ai/code/artifact/f6fd3c2f-d85b-4f7d-8669-af2d970092b9>

---

## O que se perde face à app nativa

Vale a pena saber antes de começar, não a meio.

| | App nativa | Tasker + Sheets |
|---|---|---|
| Instalação | ~2 h, Android Studio, Firebase | ~45 min |
| Corrigir um parser | recompilar e reinstalar nos dois | editar e publicar, 1 min |
| Nome dos pacotes | palpite, confirmado pelo corpus | escolhes a app numa lista |
| **Captura sem rede** | **grava e sincroniza sozinha** | **falha e perde-se** |
| Confirmar a despesa | botões na notificação | botões na notificação (bloco D) |
| Só captura com evento a decorrer | sim | sim, mesma janela e mesma tolerância |
| Ver o saldo | ecrã próprio | fórmulas na folha |
| Custo | 0 € | Tasker, ~7 € uma vez |

O ponto do meio é o que mais dói: uma compra feita num hotel sem Wi-Fi **não é
gravada**. O pedido HTTP do Tasker falha e a notificação desaparece. Há
mitigação (ver *Sobreviver sem rede*), mas dá trabalho e não é automática como
no SDK do Firestore.

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
5. Na **linha 23**, troca `muda-isto-antes-de-publicar` por uma palavra qualquer
   que inventes. **Guarda-a**, vais precisar dela no Tasker.

   Sem isto, quem descobrir o URL da web app pode escrever na vossa folha.

6. Guarda (Ctrl+S).
7. No seletor de funções escolhe **`testarAqui`** e carrega em **Executar**. O
   Google pede autorização — é a tua própria conta a autorizar o teu próprio
   script.

   No registo deves ver as duas notificações de exemplo a serem reconhecidas e a
   contagem de eventos a decorrer. Ficam criados os três separadores:
   **Despesas**, **Eventos** e **Corpus**.

### Sem evento a decorrer, não se cria despesa nenhuma

Fora de viagem, cada ida ao supermercado e cada café criariam uma linha pendente
que ninguém pediu — ao fim de um ano são centenas de linhas para apagar à mão.
Por isso só se grava uma despesa quando há um evento a decorrer.

O que **não** depende disto é o separador **Corpus**: aí fica tudo, sempre. É o
que faz esta versão servir como Fase 0 desde o primeiro dia.

8. Vai ao separador **Eventos** e escreve a primeira linha:

   | Nome | Início | Fim (inclusive) | % da 1ª pessoa | Fechado |
   |---|---|---|---|---|
   | Alentejo | 08/05/2026 | 12/05/2026 | 50 | |

   - **O fim conta o dia inteiro.** "8 a 12" inclui o dia 12 até à meia-noite.
   - A captura continua ligada **até três dias depois do fim**, porque os
     reembolsos chegam depois de a viagem acabar.
   - *Fechado*: escreve `sim` quando acertarem as contas.

   Com **um** evento a decorrer, a coluna *Evento* de cada despesa vem
   pré-preenchida. O *Estado* fica `pendente` e só entra no saldo depois de
   confirmares.

   **Nas primeiras semanas**, põe `EXIGIR_EVENTO_ATIVO = false` na linha 39.
   Assim vês os parsers a funcionar sem esperar por uma viagem — e não és
   incomodado, porque sem evento a decorrer a pergunta não aparece.

9. **Implementar → Nova implementação** → engrenagem → **App Web**:
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - **Implementar** → copia o **URL da app Web** (acaba em `/exec`)

10. Abre esse URL no browser. Deve responder:

    ```json
    {"ok":true,"servico":"ContasBabe","exigeEventoAtivo":true,"eventosAtivos":["Alentejo"]}
    ```

    Serve de diagnóstico a qualquer momento: se `eventosAtivos` vier vazio, o
    script não vai criar despesas nenhumas, e diz-to no campo `aviso`.

> Sempre que mexeres no script tens de fazer **Implementar → Gerir
> implementações → editar → Versão: Nova versão**. Guardar não chega — é o erro
> clássico do Apps Script, e não dá aviso nenhum.

---

# O Tasker

Cinco blocos, cada um com uma verificação no fim. Não avances sem a passares:
assim, quando alguma coisa falhar, sabes exatamente onde.

Antes de começar, no telemóvel: instala o **Tasker**, dá-lhe **acesso a
notificações** (⋮ → Mais → Android Settings → Notification Access) e **exclui-o
da otimização de bateria**.

## A. Prova de vida (~5 min)

Confirmar que o telemóvel fala com a folha, sem notificações pelo meio.

**A1.** Separador **Tarefas** → **+** → nome `CB Teste`.

**A2.** **+ → Rede → Pedido HTTP** (nas versões antigas, *HTTP Post*):

| Campo | Valor |
|---|---|
| Método | `POST` |
| URL | o teu URL `/exec` |
| Cabeçalhos | `Content-Type:application/json` |
| Tempo limite | `30` |

Corpo — troca o segredo:

```json
{
  "segredo": "A-TUA-PALAVRA",
  "pessoa": "pedro",
  "pacote": "pt.sibs.android.mbway",
  "titulo": "Compra QRCode",
  "texto": "Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada."
}
```

É o texto real de uma compra MB Way — o mesmo que serve de fixture aos testes.

**A3.** **+ → Alerta → Flash** → Texto: `%http_data`
(nas versões antigas, `%HTTPD`).

**A4.** Volta ao ecrã da tarefa e toca no **▶** em baixo à esquerda.

> **Confere:** o flash mostra `{"ok":true,"resultado":"despesa criada (linha 2)"…}`,
> e a folha `Corpus` tem uma linha nova. **Corre outra vez:** a resposta deve
> mudar para `duplicado descartado` — é a deduplicação a trabalhar.

## B. Descobrir as variáveis (~5 min)

Os nomes das variáveis do evento de notificação mudam entre versões do Tasker.
Em vez de adivinhar, vês — e com uma app que consegues disparar à vontade, em
vez de esperar por uma compra.

**B1.** **Perfis → + → Evento → UI → Notificação**. No campo **App** escolhe uma
app fácil de fazer notificar (Mensagens, WhatsApp). Título e Texto vazios.

**B2.** Tarefa nova, `CB Espreitar`, com **+ → Alerta → Flash**. No campo Texto
toca no ícone da **etiqueta (⊞)** — abre a lista das variáveis disponíveis neste
contexto. Insere as que parecerem o título e o texto:

```
1=%evtprm1 | 2=%evtprm2 | 3=%evtprm3
```

É um palpite razoável. Se a tua lista mostrar nomes diferentes, usa os dela.

**B3.** Manda uma mensagem a ti próprio e vê o flash.

> **Confere:** sabes o nome da variável do **título** e a do **texto**. Apaga o
> perfil descartável (carregar longamente no nome → Eliminar).

## C. O perfil a sério (~10 min)

**C1.** **Perfis → + → Evento → UI → Notificação** → App: **MB Way**.
Tarefa nova: `CB MB Way`.

**C2.** **+ → Variável → Pesquisar e Substituir**:

| Campo | Valor |
|---|---|
| Variável | a do texto (bloco B) |
| Pesquisar | `["\\]` |
| Substituir Correspondências | ligado |
| Substituir por | *(vazio)* |

Um comerciante com aspas no nome parte o JSON antes de sair do telemóvel, e o
pedido perde-se sem deixar rasto. Uma aspa a menos num nome de café não custa
nada.

**C3.** **+ → Rede → Pedido HTTP** — igual ao A2 (podes copiar a ação: carregar
longamente → Copiar), só muda o corpo:

```json
{
  "segredo": "A-TUA-PALAVRA",
  "pessoa": "pedro",
  "pacote": "pt.sibs.android.mbway",
  "titulo": "%evtprm1",
  "texto": "%evtprm2",
  "quando": "%TIMES"
}
```

- `%evtprm1` e `%evtprm2` → as variáveis do bloco B
- `pedro` → `lisa` no outro telemóvel. É isto que diz quem pagou
- `pacote` → uma etiqueta que **tu** controlas, não algo que o Tasker adivinhe

> **Confere:** põe um Flash com `%http_data` no fim, faz uma compra pequena e vê
> a linha aparecer na folha.

## D. A pergunta no telemóvel (~15 min)

```
CAFE ORFEU — 0,95 €
Guardar em Alentejo?
[ Guardar ]  [ Só minha ]  [ Não é da viagem ]
```

Com um evento de cada vez, a pergunta interessante deixa de ser *"qual evento?"*
e passa a ser *"isto é partilhado ou só teu?"*.

**D1.** Na tarefa `CB MB Way`, a seguir ao HTTP: **+ → Tarefa → If**

| Campo | Valor |
|---|---|
| Se | `%http_data` |
| Condição | corresponde a (`~`) |
| Valor | `*"perguntar":true*` |

O servidor põe `perguntar` a `false` fora de viagem e nas despesas já
despachadas — sem isto, cada ida ao supermercado interrompia-te.

**D2.** Três **Variável → Pesquisar e Substituir**, todas com Variável
`%http_data` e **Guardar Correspondências Em** ligado:

| Pesquisar | Guardar em | Fica em |
|---|---|---|
| `"linha":(\d+)` | `%linha` | `%linha1` |
| `"titulo":"([^"]+)"` | `%titulo` | `%titulo1` |
| `"subtitulo":"([^"]+)"` | `%subtitulo` | `%subtitulo1` |

**D3.** **+ → Alerta → Notificar**, Título `%titulo1`, Texto `%subtitulo1`, e
três botões, todos a chamar a tarefa `CB Responder`:

| Etiqueta | Par1 | Par2 |
|---|---|---|
| Guardar | `confirmar` | `%linha1` |
| Só minha | `soMinha` | `%linha1` |
| Não é da viagem | `descartar` | `%linha1` |

Fecha com **+ → Tarefa → End If**.

> Se a tua versão não deixar passar parâmetros aos botões, cria três tarefas
> pequenas e **deixa o `linha` de fora do D4**. O servidor assume a última
> despesa pendente dessa pessoa, que é exatamente a da notificação.

**D4.** Tarefa nova, `CB Responder`, com três ações:

1. **Rede → Pedido HTTP**, POST, o mesmo URL e cabeçalho, corpo:

   ```json
   {
     "segredo": "A-TUA-PALAVRA",
     "pessoa": "pedro",
     "acao": "%par1",
     "linha": "%par2"
   }
   ```

2. **Alerta → Notificação Cancelar** — para a notificação sair do ecrã.
3. **Alerta → Flash** com `%http_data`. Tira quando confiares no fluxo.

> **Confere:** com um evento a decorrer, corre o `CB Teste` com um valor
> diferente (muda `0.95` para `1.45`, senão a deduplicação come-o). A
> notificação aparece com os três botões, e tocar em **Guardar** muda o *Estado*
> na folha para `confirmada`.

## E. As outras origens, o outro telemóvel (~10 min)

**E1.** Carrega longamente em `CB MB Way` → **Duplicar**. Na cópia muda uma
linha só:

| Origem | `pacote` |
|---|---|
| Santander | `pt.santandertotta.mobileapp` |
| Wallet | `com.google.android.apps.walletnfcrel` |

Depois um perfil novo para cada, com a app respetiva.

O parser da Wallet ainda é um stub: as notificações dela vão continuar a chegar
ao `Corpus` e a não criar despesas. Cria o perfil na mesma — é ele que recolhe o
texto que falta.

**E2.** Exporta os perfis (carregar longamente → **Exportar**) e importa no
segundo telemóvel. Muda **uma coisa só** em cada tarefa: `"pessoa": "pedro"`
passa a `"pessoa": "lisa"`.

Se te esqueceres disto, as despesas dela aparecem em nome dele e o saldo fica
errado sem dar erro nenhum.

**E3.** Tira os Flash de diagnóstico e confirma que o Tasker continua fora da
otimização de bateria.

---

## Usar

Paga um café. Em segundos aparece uma linha nas **Despesas** com `Estado =
pendente` e o *Evento* já preenchido, e o telemóvel pergunta.

**Para tratar na folha**, muda *Estado* para `confirmada` ou `descartada`.

> **Não apagues as linhas descartadas.** A deduplicação olha para elas: se
> apagares a captura do MB Way, a do Santander que chegou 45 segundos depois
> deixa de encontrar par e renasce como despesa a dobrar.

Para não escrever à mão, seleciona as colunas *Evento* e *Estado* e usa
**Dados → Validação de dados → Lista de itens**.

> **Se algo falhar, o primeiro sítio a olhar é a coluna *Resultado* do
> `Corpus`.** Ela diz o que aconteceu a cada notificação: `despesa criada`,
> `duplicado descartado`, `enriqueceu a linha N`, `sem evento ativo`,
> `não reconhecido`.

### O saldo

Cria um separador **Saldo**, com as etiquetas na coluna A e isto na B:

| | A | B |
|---|---|---|
| 1 | Evento | `Alentejo` |
| 2 | % do Pedro | `=VLOOKUP($B$1;Eventos!A:D;4;FALSO)` |
| 4 | Pedro pagou | `=SUMIFS(Despesas!C:C;Despesas!B:B;"pedro";Despesas!J:J;$B$1;Despesas!K:K;"confirmada")/100` |
| 5 | Pedro só dele | `=SUMIFS(Despesas!C:C;Despesas!B:B;"pedro";Despesas!J:J;$B$1;Despesas!K:K;"confirmada";Despesas!I:I;VERDADEIRO)/100` |
| 6 | Lisa pagou | `=SUMIFS(Despesas!C:C;Despesas!B:B;"lisa";Despesas!J:J;$B$1;Despesas!K:K;"confirmada")/100` |
| 7 | Lisa só dela | `=SUMIFS(Despesas!C:C;Despesas!B:B;"lisa";Despesas!J:J;$B$1;Despesas!K:K;"confirmada";Despesas!I:I;VERDADEIRO)/100` |
| 9 | Comum | `=(B4-B5)+(B6-B7)` |
| 10 | Pedro devia | `=ARRED(B9*B2/100;2)` |
| 11 | **Saldo do Pedro** | `=(B4-B5)-B10` |

Positivo, tem a receber. Negativo, deve. Só entram as linhas `confirmada`.

### Registar à mão

Escreve uma linha nova: *Quando*, *Pagou*, *Cêntimos* (**em cêntimos**: `1250`
para 12,50 €), *Origem* = `manual`, *Evento*, *Estado* = `confirmada`. A coluna
*Valor* é só apresentação — põe `=C<linha>/100`.

Se pagaste com cartão, a notificação do Santander que chegar a seguir é
descartada sozinha.

---

## Sobreviver sem rede

Uma compra sem rede perde-se. A mitigação no Tasker:

1. A seguir ao Pedido HTTP, um **If `%http_response_code` não corresponde a
   `200`** → **Ficheiro → Escrever ficheiro**, acrescentando o corpo a um
   ficheiro de pendentes.
2. Um perfil **Estado → Rede → Wi-Fi ligado** que lê esse ficheiro, reenvia cada
   linha, e apaga se correr bem.

São mais umas seis ações. É exatamente esta fila que o SDK do Firestore dá de
borla na versão nativa — e foi a razão principal para o plano ter escolhido o
Firestore.

---

## Armadilhas

| Sintoma | Causa | O que fazer |
|---|---|---|
| Notificações a repetir sem fim | Um perfil está a ouvir as notificações **do próprio Tasker**: a confirmação dispara o perfil, que gera outra | Filtra sempre por app, e nunca escolhas o Tasker |
| Mudaste o script e nada mudou | Guardar não publica | **Implementar → Gerir implementações → editar → Nova versão** |
| Resposta em HTML em vez de JSON | O URL não é o `/exec`, ou o acesso não é "Qualquer pessoa" | Abre o URL no browser |
| `{"ok":false,"erro":"segredo errado"}` | O segredo do Tasker não é o do script | Passo 5 e blocos A2/C3 |
| Nada chega a folha nenhuma | O Tasker não tem acesso a notificações | Antes do bloco A |
| `Corpus` diz `sem evento ativo` | Nenhuma linha em *Eventos* inclui hoje | Passo 8, ou `EXIGIR_EVENTO_ATIVO = false` |
| `Corpus` diz `não reconhecido` | O texto não bate certo, ou é a Wallet | Manda-me a linha do `Corpus` |
| A notificação não aparece | `perguntar` veio a `false`, ou o `If` do D1 não bate | Abre o `/exec` e vê `eventosAtivos` |
| Tocar num botão não faz nada | Corpo mal montado, ou segredo errado | O Flash do D4 mostra a resposta |
| Confirmou a despesa errada | Duas compras chegaram antes de responderes e os botões não passaram a `linha` | Passa o `%linha1` nos parâmetros (D3) |
| Funcionou uns dias e parou | O Android matou o Tasker | Otimização de bateria |

---

## Se um dia quiseres a app nativa

O código está todo escrito e testado neste repositório — ver
[`../instalacao.md`](../instalacao.md). E o `Corpus` que esta versão recolheu é
exatamente o que falta para fechar os parsers da Wallet, os estornos e as
transferências.

Uma coisa não se herda: as despesas que já estiverem na folha não passam para o
Firestore sozinhas.
