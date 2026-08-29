/**
 * Service worker: guarda a app inteira — página, ícones e os 9 MB do OCR —
 * para que abrir o atalho funcione sem rede nenhuma. É essa a razão de o
 * Tesseract viver em vendor/ e não num CDN.
 *
 * Duas estratégias, porque os ficheiros não são todos da mesma natureza:
 *
 * - **vendor/**: cache primeiro. São 9 MB que nunca mudam; ir à rede
 *   perguntar por eles a cada abertura seria pagar latência para nada.
 * - **tudo o resto** (a página, o manifesto, os ícones): rede primeiro, com
 *   três segundos de paciência e a cache como rede de segurança. Sem isto a
 *   app ficava presa na versão instalada **para sempre**: cache primeiro
 *   servia sempre o index.html guardado, e o service worker só se reinstala
 *   quando o próprio sw.js muda. Publicar uma versão nova não chegava ao
 *   telemóvel de ninguém — e não havia sinal nenhum de que assim era.
 *
 * Offline não muda: falha a rede, responde a cache, e uma navegação sem nada
 * em cache cai no index.html.
 */

const CACHE = 'contasbabe-v2'

/** Só o que nunca muda. O resto vale a pena reconfirmar. */
const IMUTAVEL = /\/vendor\//

const LIMITE_MS = 3000

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

async function guardar(pedido, resposta) {
  // Respostas de erro não se guardam: uma 404 em cache seria permanente.
  if (!resposta.ok) return resposta
  const copia = resposta.clone()
  const cache = await caches.open(CACHE)
  await cache.put(pedido, copia)
  return resposta
}

async function cachePrimeiro(pedido) {
  const emCache = await caches.match(pedido)
  if (emCache) return emCache
  return guardar(pedido, await fetch(pedido))
}

async function redePrimeiro(pedido) {
  try {
    // Com limite de tempo: offline falha logo, mas uma rede de hotel a
    // arrastar-se deixaria o arranque pendurado sem isto.
    const resposta = await Promise.race([
      fetch(pedido),
      new Promise((_, rejeitar) => setTimeout(() => rejeitar(new Error('lenta')), LIMITE_MS)),
    ])
    return guardar(pedido, resposta)
  } catch {
    const emCache = await caches.match(pedido)
    if (emCache) return emCache
    if (pedido.mode === 'navigate') {
      const app = await caches.match('./index.html')
      if (app) return app
    }
    throw new Error('offline')
  }
}

self.addEventListener('fetch', (evento) => {
  const pedido = evento.request
  if (pedido.method !== 'GET') return
  // Só o que é nosso: as fontes do Google degradam-se sozinhas para a stack
  // do sistema e não vale a pena guardá-las.
  const url = new URL(pedido.url)
  if (url.origin !== self.location.origin) return

  evento.respondWith(IMUTAVEL.test(url.pathname) ? cachePrimeiro(pedido) : redePrimeiro(pedido))
})
