# Prompt — funcionalidades da app

Prompt de desenvolvimento centrado só no comportamento da app: o que ela faz,
para quem, e o que tem de acontecer em cada caso. Sem stack, sem arquitetura,
sem schema — isso está em `docs/plano.md` e no `CLAUDE.md`.

---

Constrói uma app Android para duas pessoas (um casal) partilharem despesas de
viagens e outros períodos com contas em comum. A app tem de responder, em
segundos e sem contas de cabeça, a "quem deve a quem, agora" — e apanhar as
despesas sozinha, a partir das notificações de pagamento do telemóvel, para que
ninguém tenha de registar nada à mão durante a viagem.

Funcionalidades a implementar:

**1. Duas pessoas, uma conta partilhada**
- Exatamente dois utilizadores, cada um no seu telemóvel, a ver os mesmos dados.
- Cada um entra com a conta Google. No primeiro arranque escolhe quem é (Pedro
  ou Lisa) e essa escolha fica gravada.
- Tudo o que um faz aparece no telemóvel do outro sem ninguém carregar em
  atualizar.
- Funciona offline: uma despesa registada ou capturada sem rede fica gravada e
  sobe sozinha depois. A app nunca bloqueia à espera de rede.
- Moeda única: euro.

**2. Eventos (viagens e períodos)**
- Criar eventos com nome, data de início e data de fim. Podem existir vários ao
  mesmo tempo (ex.: "Alentejo" e "Casa" em simultâneo).
- Cada evento tem a sua divisão em percentagem por pessoa, por omissão 50/50, e
  editável (ex.: 60/40). A soma tem de dar 100.
- Toda a despesa pertence a um evento. Sem evento ativo, não há captura
  automática.
- Lista de eventos com o período, o estado (aberto/fechado) e o saldo de cada um.

**3. Captura automática de despesas**
- A app lê as notificações de pagamento do telemóvel e transforma-as em despesas
  sozinha, com a app fechada e o ecrã bloqueado.
- Origens: Google Wallet e MB Way como primárias (dão o comerciante), e o
  Santander como rede de segurança (dá o valor e os últimos 4 dígitos do cartão,
  sem comerciante).
- De cada notificação extrai: valor, comerciante quando existe, últimos 4
  dígitos do cartão quando existem, e a hora.
- Ignora o que não é uma compra: pedidos de autorização 3D Secure (a compra
  ainda não aconteceu), notificações promocionais e qualquer texto que não bata
  certo com o padrão completo. Nunca capturar só por ver um número seguido de €.
- Uma compra pode gerar duas notificações (a do MB Way e a do Santander, ~45
  segundos depois): a app tem de perceber que é a mesma compra e ficar com uma
  só despesa, escolhendo a versão que traz mais informação (comerciante). Duas
  compras iguais seguidas — dois cafés na mesma ronda — contam as duas. Na
  dúvida, cria: um duplicado apaga-se num toque, uma despesa engolida
  desaparece para sempre.
- Uma despesa registada à mão também conta como a mesma compra se a notificação
  do banco chegar logo a seguir — ganha o registo manual.

**4. Confirmação por notificação**
- Assim que uma despesa é capturada, aparece uma notificação com o comerciante e
  o valor, e botões para a tratar sem abrir a app:
  - um evento ativo → botão direto com o nome do evento;
  - vários ativos → um botão que abre a lista de eventos para escolher;
  - "Não é da viagem" → a despesa sai da vista (mas não se apaga);
  - nenhum evento ativo → não notifica nem grava nada.
- Para efeito de captura, um evento conta como ativo desde o início até 3 dias
  depois do fim, se não estiver fechado. Os três dias existem porque os
  reembolsos e os acertos de caução chegam depois de a viagem acabar.
- Sem resposta à notificação, a despesa fica pendente na caixa "Por tratar".

**5. Caixa "Por tratar"**
- Lista de todas as despesas capturadas e ainda não atribuídas.
- Para cada uma: sugere o evento provável a partir da data, e permite confirmar,
  mudar de evento, marcar como "100% minha", editar a descrição ou descartar.
- Despesas do Santander sem par não trazem comerciante — a app pede descrição.
- Lembrete diário às 21h30, se houver pendentes, que abre diretamente esta lista.

**6. Registo manual**
- Adicionar uma despesa à mão: valor, descrição, quem pagou, evento, data.
- Valores negativos para reembolsos e estornos (o cálculo do saldo trata-os sem
  regra especial).
- Marcar qualquer despesa como "100% minha": entra na lista do evento, mas não
  se divide com a outra pessoa.
- Editar e apagar despesas.

**7. Saldo**
- Ecrã inicial com um número dominante: quem deve a quem e quanto, somando todos
  os eventos ainda abertos. Se estiverem quites, diz "Estão quites".
- Por evento, o mesmo cálculo isolado.
- Regra do cálculo: soma-se o que cada um pagou, tiram-se as despesas "100%
  minha", e o que sobra divide-se pela percentagem do evento. Exemplo: Pedro
  gasta 50 €, Lisa 75 €, a 50/50 → o comum são 125 €, cada um devia 62,50 € →
  Pedro deve 12,50 € à Lisa.
- Numa divisão desigual de um valor ímpar não se pode perder nem inventar um
  cêntimo: uma parte arredonda-se, a outra é a diferença.
- Todo o dinheiro se trata em cêntimos inteiros, do ecrã ao armazenamento. Nunca
  em vírgula flutuante.
- Formatação portuguesa feita à mão (1 234,56 €), igual em qualquer telemóvel.

**8. Fechar e acertar**
- Marcar um evento como fechado, guardando o valor efetivamente transferido
  entre as duas pessoas.
- Um evento fechado deixa de contar para o saldo do ecrã inicial, mas continua
  consultável com todas as despesas.
- Possibilidade de reabrir um evento fechado.

**9. Dashboard anual**
- Total gasto no ano como número dominante, com os eventos ainda abertos
  incluídos mas assinalados como provisórios.
- Barras por evento, ordenadas por valor gasto (não por data), com o custo por
  dia debaixo de cada uma — é a única comparação justa entre um fim de semana e
  dez dias fora.
- Em baixo e discreto, o gasto individual de cada pessoa.
- Sem categorias e sem classificação manual de despesas.

**10. Avisos de falha silenciosa**
- A app tem de avisar quando deixa de capturar, porque as duas falhas típicas
  não dão erro nenhum:
  - o serviço de captura foi morto pelo sistema → aviso se um dos telemóveis não
    der sinal de vida há mais de 24 horas;
  - o banco mudou o texto da notificação → aviso se passarem 7 dias de evento
    ativo sem uma única captura automática.
- Os avisos são visíveis para os dois: o telemóvel calado é invisível para o
  dono, mas não para a outra pessoa.

**11. Configuração e primeira instalação**
- Ecrã que mostra os passos obrigatórios e o estado real de cada um: acesso às
  notificações concedido, autorização para publicar notificações, exclusão da
  otimização de bateria, e quem é quem. Todos com atalho para as definições do
  sistema.
- Terminar sessão.

**12. Ecrã de debug do parser**
- Colar o texto de uma notificação à mão e ver exatamente o que a app extraiu
  (valor, comerciante, cartão) ou porque descartou.
- Exportar o registo das notificações recebidas, para servir de base quando um
  banco mudar o formato.

Requisitos transversais:
- Nada de ecrãs de carregamento longos: a app abre no saldo, já com os dados que
  tem em cache.
- Todos os textos da interface em português de Portugal.
- Cada regra de dinheiro, de datas e de leitura de notificações tem de ter teste
  automático, com o texto real da notificação como fixture. Nenhum parser se
  escreve a partir de um formato imaginado.
