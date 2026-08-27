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
| Confirmar a despesa | botões na própria notificação | escrever o evento na folha |
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

   No registo deves ver as duas notificações de exemplo a serem reconhecidas.
   Se vires isso, o parsing funciona.

8. **Implementar → Nova implementação** → engrenagem → **App Web**:
   - Descrição: `ContasBabe`
   - Executar como: **Eu**
   - Quem tem acesso: **Qualquer pessoa**
   - **Implementar** → copia o **URL da app Web** (acaba em `/exec`)

9. Abre esse URL no browser. Deve responder:

   ```json
   {"ok":true,"servico":"ContasBabe","despesas":"Despesas"}
   ```

   Se responder isso, o servidor está de pé.

> Sempre que mexeres no script tens de fazer **Implementar → Gerir
> implementações → editar → Versão: Nova versão**. Guardar não chega — é o erro
> clássico do Apps Script.

## 3. O Tasker (~20 min, em cada telemóvel)

10. Instala o **Tasker** da Play Store.
11. Dá-lhe acesso a notificações: no Tasker, **⋮ → Mais → Android Settings →
    Notification Access** → liga o Tasker.
12. Exclui o Tasker da otimização de bateria. Sem isto o Android mata-o, tal
    como mataria o serviço da app nativa.

### Um perfil por origem

Faz-se três vezes — Wallet, MB Way e Santander — e é de propósito: assim o
`pacote` que chega ao servidor é uma etiqueta que **tu** controlas, e não algo
que o Tasker tenha de adivinhar. O problema dos nomes de pacote desaparece.

13. **+ → Perfil → Evento → UI → Notificação**
    - **App**: escolhe da lista (Google Wallet, ou MB Way, ou Santander)
    - Deixa o resto vazio
14. Ao sair, o Tasker pede uma tarefa. Cria uma nova, com o nome da origem.

15. **Antes do HTTP, vê o que o Tasker te dá.** Adiciona uma ação
    **Alerta → Flash**, e no texto usa o botão de variáveis (a etiqueta ⊞) para
    inserir as variáveis da notificação — os nomes mudam entre versões do
    Tasker. Guarda, faz uma compra pequena, e vê o que aparece no ecrã.

    Anota qual delas traz o **título** e qual traz o **texto**.

16. Apaga o Flash e põe **Rede → Pedido HTTP**:
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
    - `%ntitle` e `%ntext` pelas variáveis que descobriste no passo 15
    - `pacote` conforme o perfil:

      | Perfil | `pacote` |
      |---|---|
      | Google Wallet | `com.google.android.apps.walletnfcrel` |
      | MB Way | `pt.sibs.android.mbway` |
      | Santander | `pt.santandertotta.mobileapp` |

17. Repete os passos 13–16 para as outras duas origens.
18. Repete tudo no segundo telemóvel, com `"pessoa": "lisa"`.

    (Podes exportar o perfil no primeiro telemóvel — carregar longamente no
    nome → **Exportar** — e importá-lo no segundo, mudando só a `pessoa`.)

---

## 4. Usar

Paga um café. Em segundos deve aparecer uma linha na folha **Despesas**, com
`Estado = pendente`.

**Para tratar a despesa**, escreve o nome do evento na coluna *Evento* e muda
*Estado* para `confirmada`. Ou `descartada`, se não for da viagem.

> **Não apagues as linhas descartadas.** A deduplicação olha para elas: se
> apagares a captura do MB Way, a do Santander que chegou 45 segundos depois
> deixa de encontrar par e renasce como despesa a dobrar.

Para não escrever à mão de cada vez, seleciona as colunas *Evento* e *Estado* e
usa **Dados → Validação de dados → Lista de itens**, com os teus eventos e com
`pendente, confirmada, descartada`.

### O saldo

Cria um separador **Saldo** e cola isto em `A1`:

```
Evento:            Alentejo
% do Pedro:        50

Pedro pagou:       =SUMIFS(Despesas!C:C;Despesas!B:B;"pedro";Despesas!J:J;$B$1;Despesas!K:K;"confirmada")/100
Pedro só dele:     =SUMIFS(Despesas!C:C;Despesas!B:B;"pedro";Despesas!J:J;$B$1;Despesas!K:K;"confirmada";Despesas!I:I;TRUE)/100
Lisa pagou:        =SUMIFS(Despesas!C:C;Despesas!B:B;"lisa";Despesas!J:J;$B$1;Despesas!K:K;"confirmada")/100
Lisa só dela:      =SUMIFS(Despesas!C:C;Despesas!B:B;"lisa";Despesas!J:J;$B$1;Despesas!K:K;"confirmada";Despesas!I:I;TRUE)/100

Comum:             =(B4-B5)+(B6-B7)
Pedro devia:       =ROUND(B9*$B$2/100;2)
Saldo do Pedro:    =(B4-B5)-B10
```

Positivo, tem a receber. Negativo, deve. Muda `B1` para ver outro evento.

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

| Sintoma | Causa quase certa | O que fazer |
|---|---|---|
| Nada chega à folha | O Tasker não tem acesso a notificações | Passo 11 |
| Chega ao `Corpus` mas não às `Despesas` | O texto não bate certo com o parser, ou é a Wallet (que ainda é um stub) | Vê a coluna *Reconhecido*. Manda-me o texto do `Corpus` |
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
