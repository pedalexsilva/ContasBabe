/**
 * Service worker: guarda a app inteira — página, ícones e os 9 MB do OCR —
 * para que abrir o atalho funcione sem rede nenhuma. É essa a razão de o
 * Tesseract viver em vendor/ e não num CDN.
 *
 * Estratégia: cache primeiro. São ficheiros com conteúdo fixo, e o custo de
 * ir à rede primeiro seria pagar latência em todas as aberturas para nada.
 * Muda-se de versão em CACHE quando o conteúdo muda — o activate limpa as
 * antigas e a app passa a servir a nova.
 */

const CACHE = 'contasbabe-v1'

const FICHEIROS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icone-192.png',
  './icone-512.png',
  './icone-maskable-512.png',
  './vendor/tesseract.min.js',
  './vendor/worker.min.js',
  './vendor/tesseract-core-simd-lstm.wasm.js',
  './vendor/tesseract-core-lstm.wasm.js',
  './vendor/por.traineddata.gz',
]

self.addEventListener('install', (evento) => {
  // Os dois cores são 7,9 MB e só um deles é usado neste telemóvel; não vale
  // a pena falhar a instalação inteira se um ficheiro não vier.
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => Promise.allSettled(FICHEIROS.map((f) => cache.add(f))))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((nomes) => Promise.all(nomes.filter((n) => n !== CACHE).map((n) => caches.delete(n))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  // Só o que é nosso: as fontes do Google degradam-se sozinhas para a stack
  // do sistema e não vale a pena guardá-las.
  if (new URL(pedido.url).origin !== self.location.origin) return

  evento.respondWith(
    caches.match(pedido).then((emCache) => {
      if (emCache) return emCache
      return fetch(pedido).then((resposta) => {
        // Guarda o que for aparecendo (um core que não estava na lista, por
        // exemplo). Respostas de erro não se guardam.
        if (resposta.ok) {
          const copia = resposta.clone()
          caches.open(CACHE).then((cache) => cache.put(pedido, copia))
        }
        return resposta
      }).catch(() => {
        // Offline e fora da cache: numa navegação, devolve a app.
        if (pedido.mode === 'navigate') return caches.match('./index.html')
        throw new Error('offline')
      })
    }),
  )
})
