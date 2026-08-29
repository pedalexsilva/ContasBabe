# Protótipo MB Way — pôr no telemóvel

O objetivo é um ícone no ecrã principal que abre a app com um toque, sem barra
de browser à volta e a funcionar sem rede. Para isso a pasta tem de ser
**servida por http(s)** — não vale abrir o ficheiro diretamente.

## Porque é que não chega abrir o ficheiro

Um `file:///.../index.html` aberto no Chrome do Android dá um atalho pobre:
sem ícone próprio, sem ecrã inteiro, e — o que mais dói — **sem service
worker**, que é o que guarda a app e os 9 MB do OCR para funcionar offline. Pior:
o armazenamento de páginas `file://` é o mais fácil de o sistema limpar, e a
base de dados com as despesas vai com ele. Servido por http(s), a origem é
estável e o Android trata a app como aplicação instalada.

## Opção A — GitHub Pages (recomendado, uma vez só)

1. No GitHub: **Settings → Pages**, `Source: Deploy from a branch`,
   escolher o ramo e a pasta `/ (root)`.
2. Esperar um minuto. O endereço fica
   `https://pedalexsilva.github.io/ContasBabe/prototipo/`.
3. No telemóvel, abrir esse endereço no **Chrome**.
4. Menu (⋮) → **"Instalar aplicação"** (ou "Adicionar ao ecrã principal").
5. O ícone verde aparece no ecrã principal. Abre em ecrã inteiro e funciona
   sem rede a partir daí.

O repositório tem de estar público para o Pages funcionar sem subscrição paga.
A página não leva dados nenhuns: as despesas ficam na base de dados do teu
telemóvel e nunca saem dele. Quem abrisse o endereço via só a app vazia.

## Opção B — sem hospedar nada

Serve a pasta do portátil e abre pelo Wi-Fi de casa:

```bash
cd prototipo && python3 -m http.server 8000
# no telemóvel: http://<ip-do-portatil>:8000
```

Instala-se da mesma maneira (passo 4 acima) e, depois de instalada, **funciona
sem o portátil ligado** — o service worker já guardou tudo. O que deixa de
funcionar é a atualização para versões novas.

## Opção C — abrir o ficheiro à bruta (o OCR não funciona)

Abrir o `index.html` a partir do gestor de ficheiros dá a app a funcionar
— lista, eventos, percentagens, registo à mão — **mas sem OCR**. Não é
descuido: numa origem `file://` o browser recusa que a página vá buscar os
ficheiros do Tesseract ao lado dela (o worker usa `fetch`, que ali é
proibido). A app diz-to em vez de te deixar à espera.

Serve para espreitar o aspeto. Para carregar screenshots, tem de ser a
opção A ou a B.

## Depois de instalada

- **Guardar cópia**: o botão `exportar` grava um JSON com tudo. Vale a pena
  antes de mexer no telefone.
- **Atualizar**: reabrir a app com rede; o service worker vai buscar a versão
  nova e aplica-a na abertura seguinte.
- **Os dados são por origem**: instalada a partir do endereço do GitHub Pages,
  as despesas vivem nesse endereço. Se depois abrires a mesma app por outro
  endereço, aparece vazia — os dados não se perderam, estão no outro.

## O que a app precisa da rede

Nada, depois da primeira abertura. O Tesseract e o modelo de português vivem
em `vendor/` e são guardados na instalação; só as fontes vêm do Google e, sem
elas, a app usa as do sistema sem se queixar.
