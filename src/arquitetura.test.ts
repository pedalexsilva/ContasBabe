// @vitest-environment node
// Lê o disco: num ambiente jsdom, `import.meta.url` é um URL http e o caminho
// que daí sai não existe. O teste passava a falhar sem nada ter mudado no código.

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

/**
 * As regras de arquitetura do plano, escritas de maneira a falharem sozinhas.
 *
 * Um documento diz "nada de SDK web" e alguém escreve na mesma daqui a três
 * meses; um teste diz o mesmo e o `npm test` fica vermelho.
 */

const SRC = dirname(fileURLToPath(import.meta.url))

function ficheirosDe(dir: string): string[] {
  return readdirSync(dir).flatMap((nome) => {
    const caminho = join(dir, nome)
    if (statSync(caminho).isDirectory()) return ficheirosDe(caminho)
    return ['.ts', '.tsx'].includes(extname(nome)) ? [caminho] : []
  })
}

const TODOS = ficheirosDe(SRC)

function importsDe(caminho: string): string[] {
  const conteudo = readFileSync(caminho, 'utf8')
  return [...conteudo.matchAll(/(?:from|import)\s+['"]([^'"]+)['"]/g)].map((m) => m[1] ?? '')
}

describe('o SDK web do Firebase não entra no código', () => {
  it('nenhum ficheiro importa firebase/* diretamente', () => {
    // O `firebase` está instalado só como devDependency, porque o bundler
    // precisa dele para resolver o fallback web do plugin. Importá-lo aqui
    // traria de volta os três problemas que o plugin nativo resolve: o
    // Google Sign-In bloqueado em WebView, uma segunda cache offline, e o
    // serviço em Kotlin a escrever sem sessão.
    const infratores = TODOS.filter((f) =>
      importsDe(f).some((i) => i === 'firebase' || i.startsWith('firebase/')),
    ).map((f) => relative(SRC, f))

    expect(infratores).toEqual([])
  })
})

describe('o domínio é puro', () => {
  const dominio = TODOS.filter((f) => f.includes(`${'dominio'}/`))

  it('há de facto ficheiros de domínio para verificar', () => {
    expect(dominio.length).toBeGreaterThan(0)
  })

  it('não conhece Firestore, Capacitor nem React', () => {
    // É isto que mantém `saldo.ts` testável em milissegundos e sem telemóvel.
    const infratores = dominio
      .map((f) => ({
        ficheiro: relative(SRC, f),
        maus: importsDe(f).filter(
          (i) =>
            i.startsWith('@capacitor') ||
            i.startsWith('firebase') ||
            i === 'react' ||
            i.startsWith('react/') ||
            i.includes('dados/'),
        ),
      }))
      .filter((x) => x.maus.length > 0)

    expect(infratores).toEqual([])
  })
})

describe('a UI não calcula saldos', () => {
  it('os ecrãs não repetem a aritmética do domínio', () => {
    // Não deteta tudo, mas apanha o caso real: alguém precisa de um total num
    // ecrã e escreve o `reduce` ali mesmo, e a partir daí há duas verdades.
    const ecrans = TODOS.filter((f) => f.includes(`${'ecrans'}/`))
    const infratores = ecrans
      .filter((f) => /valorCent\s*\*|\breduce\s*\(\s*\(?\s*\w+\s*,\s*\w+\s*\)?\s*=>[^)]*valorCent/.test(readFileSync(f, 'utf8')))
      .map((f) => relative(SRC, f))

    expect(infratores).toEqual([])
  })
})
