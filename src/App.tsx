import { App as AppNativa } from '@capacitor/app'
import { useCallback, useEffect, useState } from 'react'
import { entrarComGoogle } from './dados/auth'
import Configuracao from './ecrans/Configuracao'
import Dashboard from './ecrans/Dashboard'
import Debug from './ecrans/Debug'
import EcraEvento from './ecrans/Evento'
import Eventos from './ecrans/Eventos'
import Inicio from './ecrans/Inicio'
import NovaDespesa from './ecrans/NovaDespesa'
import NovoEvento from './ecrans/NovoEvento'
import PorTratar from './ecrans/PorTratar'
import { useApp } from './estado'

export type Ecra =
  | { nome: 'inicio' }
  | { nome: 'eventos' }
  | { nome: 'dashboard' }
  | { nome: 'evento'; id: string }
  | { nome: 'novo-evento' }
  | { nome: 'nova-despesa'; eventoId: string | null }
  | { nome: 'por-tratar' }
  | { nome: 'configuracao' }
  | { nome: 'debug' }

export interface Navegacao {
  ir: (e: Ecra) => void
  voltar: () => void
}

const SEPARADORES: Ecra['nome'][] = ['inicio', 'eventos', 'dashboard']

export default function App() {
  const { utilizador, casal, eu, carregando, erro, avisos, porTratar } = useApp()
  const [pilha, setPilha] = useState<Ecra[]>([{ nome: 'inicio' }])

  const ir = useCallback((e: Ecra) => {
    setPilha((p) => (SEPARADORES.includes(e.nome) ? [e] : [...p, e]))
  }, [])

  const voltar = useCallback(() => {
    setPilha((p) => (p.length > 1 ? p.slice(0, -1) : p))
  }, [])

  // Sem isto, o botão físico de "voltar" fecha a app a meio de um formulário.
  useEffect(() => {
    let remover: (() => void) | undefined
    void AppNativa.addListener('backButton', ({ canGoBack }) => {
      if (pilha.length > 1) voltar()
      else if (!canGoBack) void AppNativa.exitApp()
    }).then((h) => {
      remover = () => void h.remove()
    })
    return () => remover?.()
  }, [pilha.length, voltar])

  // O botão [Outro evento] da notificação abre a app por um esquema próprio,
  // porque desde o Android 12 um BroadcastReceiver não pode abrir ecrãs.
  useEffect(() => {
    const abrir = (url: string | undefined) => {
      if (url?.includes('por-tratar') === true) ir({ nome: 'por-tratar' })
    }

    let remover: (() => void) | undefined
    void AppNativa.getLaunchUrl()
      .then((r) => abrir(r?.url))
      .catch(() => undefined)
    void AppNativa.addListener('appUrlOpen', ({ url }) => abrir(url)).then((h) => {
      remover = () => void h.remove()
    })
    return () => remover?.()
  }, [ir])

  if (carregando) {
    return (
      <div className="centrado">
        <p className="fraco">A carregar…</p>
      </div>
    )
  }

  if (utilizador === null) return <Entrar />

  if (erro !== null && casal === null) {
    return (
      <div className="centrado">
        <h1>Falta um passo</h1>
        <p className="fraco">{erro}</p>
      </div>
    )
  }

  if (casal !== null && eu === null) {
    return (
      <div className="centrado">
        <h1>Quem és tu?</h1>
        <p className="fraco">
          A conta {utilizador.email ?? utilizador.uid} está no casal, mas não está associada a
          nenhuma pessoa. Na consola Firebase, põe o UID <code>{utilizador.uid}</code> no campo{' '}
          <code>uid</code> da pessoa certa, dentro de <code>pessoas</code>.
        </p>
      </div>
    )
  }

  const atual = pilha[pilha.length - 1] ?? { nome: 'inicio' }
  const nav: Navegacao = { ir, voltar }
  const podeVoltar = pilha.length > 1

  return (
    <>
      <div className="cabecalho">
        {podeVoltar ? (
          <button type="button" className="discreto" onClick={voltar}>
            ← Voltar
          </button>
        ) : (
          <span style={{ flex: 1 }} />
        )}
        {atual.nome !== 'configuracao' && (
          <button
            type="button"
            className="discreto"
            aria-label="Configuração"
            onClick={() => ir({ nome: 'configuracao' })}
          >
            ⚙
          </button>
        )}
      </div>

      <main>
        {erro !== null && <p className="alerta">{erro}</p>}
        {avisos.length > 0 && (
          <div className="alerta">
            <strong>Registos que não foi possível ler:</strong>
            <ul>
              {avisos.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          </div>
        )}

        {conteudo(atual, nav)}
      </main>

      <nav className="barra-nav">
        <Separador nome="inicio" icone="⌂" texto="Início" atual={atual} ir={ir} />
        <Separador nome="eventos" icone="◈" texto="Eventos" atual={atual} ir={ir} />
        <Separador nome="dashboard" icone="▤" texto="Ano" atual={atual} ir={ir} />
        {porTratar.length > 0 && atual.nome !== 'por-tratar' && (
          <button type="button" onClick={() => ir({ nome: 'por-tratar' })}>
            <span className="icone">◇</span>
            <span>
              Por tratar <span className="pastilha">{porTratar.length}</span>
            </span>
          </button>
        )}
      </nav>
    </>
  )
}

function conteudo(ecra: Ecra, nav: Navegacao) {
  switch (ecra.nome) {
    case 'inicio':
      return <Inicio nav={nav} />
    case 'eventos':
      return <Eventos nav={nav} />
    case 'dashboard':
      return <Dashboard nav={nav} />
    case 'evento':
      return <EcraEvento eventoId={ecra.id} nav={nav} />
    case 'novo-evento':
      return <NovoEvento nav={nav} />
    case 'nova-despesa':
      return <NovaDespesa eventoId={ecra.eventoId} nav={nav} />
    case 'por-tratar':
      return <PorTratar nav={nav} />
    case 'configuracao':
      return <Configuracao nav={nav} />
    case 'debug':
      return <Debug />
  }
}

function Separador({
  nome,
  icone,
  texto,
  atual,
  ir,
}: {
  nome: 'inicio' | 'eventos' | 'dashboard'
  icone: string
  texto: string
  atual: Ecra
  ir: (e: Ecra) => void
}) {
  return (
    <button
      type="button"
      aria-current={atual.nome === nome ? 'page' : undefined}
      onClick={() => ir({ nome } as Ecra)}
    >
      <span className="icone">{icone}</span>
      <span>{texto}</span>
    </button>
  )
}

function Entrar() {
  const [aEntrar, setAEntrar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function entrar() {
    setAEntrar(true)
    setErro(null)
    try {
      await entrarComGoogle()
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e)
      setErro(
        /DEVELOPER_ERROR|10:/.test(m)
          ? `${m}\n\nQuase de certeza faltam os fingerprints SHA-1 e SHA-256 na consola Firebase, para o keystore com que esta APK foi assinada.`
          : m,
      )
    } finally {
      setAEntrar(false)
    }
  }

  return (
    <div className="centrado">
      <h1>ContasBabe</h1>
      <p className="fraco">Despesas partilhadas, sem discussões ao fim da viagem.</p>
      <button type="button" className="principal" onClick={() => void entrar()} disabled={aEntrar}>
        {aEntrar ? 'A entrar…' : 'Entrar com Google'}
      </button>
      {erro !== null && <p className="alerta">{erro}</p>}
    </div>
  )
}
