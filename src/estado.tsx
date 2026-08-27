import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { type UtilizadorAtual, outraPessoa, ouvirAutenticacao, pessoaDoUid, utilizadorAtual } from './dados/auth'
import {
  type Cancelar,
  descobrirCasal,
  ouvirCasal,
  ouvirDespesas,
  ouvirEventos,
  ouvirHeartbeats,
} from './dados/firestore'
import { calcularSaldoGlobal, type SaldoGlobal } from './dominio/saldo'
import { alertasDeSaude, type Alerta } from './dominio/saude'
import type { Casal, Despesa, Evento, Heartbeat, Pessoa } from './tipos'

/**
 * Estado partilhado da app: uma subscrição a cada coleção, e tudo o resto
 * derivado daí. O Firestore serve estes listeners do cache primeiro, por isso
 * o primeiro render é imediato mesmo sem rede.
 */

export interface EstadoApp {
  utilizador: UtilizadorAtual | null
  casalId: string | null
  casal: Casal | null
  /** Quem está a usar a app. `null` enquanto o UID não estiver no casal. */
  eu: Pessoa | null
  outra: Pessoa | null
  eventos: Evento[]
  despesas: Despesa[]
  heartbeats: Heartbeat[]
  saldo: SaldoGlobal | null
  alertas: Alerta[]
  porTratar: Despesa[]
  carregando: boolean
  erro: string | null
  /** Documentos que não converteram. Aparecem na UI em vez de desaparecerem. */
  avisos: string[]
}

const Contexto = createContext<EstadoApp | null>(null)

export function useApp(): EstadoApp {
  const estado = useContext(Contexto)
  if (estado === null) throw new Error('useApp fora do ProvedorApp')
  return estado
}

export function ProvedorApp({ children }: { children: ReactNode }) {
  const [utilizador, setUtilizador] = useState<UtilizadorAtual | null>(null)
  const [casalId, setCasalId] = useState<string | null>(null)
  const [casal, setCasal] = useState<Casal | null>(null)
  const [eventos, setEventos] = useState<Evento[]>([])
  const [despesas, setDespesas] = useState<Despesa[]>([])
  const [heartbeats, setHeartbeats] = useState<Heartbeat[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState<string | null>(null)
  const [avisos, setAvisos] = useState<string[]>([])

  useEffect(() => {
    let vivo = true
    let cancelar: (() => void) | undefined

    void (async () => {
      try {
        const inicial = await utilizadorAtual()
        if (vivo) setUtilizador(inicial)
        cancelar = await ouvirAutenticacao((u) => {
          if (vivo) setUtilizador(u)
        })
      } catch (e) {
        if (vivo) setErro(mensagem(e))
      } finally {
        if (vivo) setCarregando(false)
      }
    })()

    return () => {
      vivo = false
      cancelar?.()
    }
  }, [])

  useEffect(() => {
    if (utilizador === null) {
      setCasalId(null)
      return
    }
    let vivo = true
    void (async () => {
      try {
        const id = await descobrirCasal(utilizador.uid)
        if (!vivo) return
        if (id === null) {
          setErro(
            `A conta ${utilizador.email ?? utilizador.uid} não pertence a nenhum casal. Acrescenta o UID ${utilizador.uid} ao array "membros" do documento do casal, na consola Firebase.`,
          )
        } else {
          setErro(null)
        }
        setCasalId(id)
      } catch (e) {
        if (vivo) setErro(mensagem(e))
      }
    })()
    return () => {
      vivo = false
    }
  }, [utilizador])

  useEffect(() => {
    if (casalId === null) {
      setCasal(null)
      setEventos([])
      setDespesas([])
      setHeartbeats([])
      return
    }

    let vivo = true
    const cancelamentos: Cancelar[] = []
    const guardar = (c: Cancelar) => (vivo ? cancelamentos.push(c) : c())

    void (async () => {
      try {
        guardar(
          await ouvirCasal(casalId, (c, e) => {
            if (!vivo) return
            setCasal(c)
            setErro(e)
          }),
        )
        guardar(
          await ouvirEventos(casalId, ({ itens, falhas }) => {
            if (!vivo) return
            setEventos(itens)
            registarFalhas('evento', falhas, setAvisos)
          }),
        )
        guardar(
          await ouvirDespesas(casalId, ({ itens, falhas }) => {
            if (!vivo) return
            setDespesas(itens)
            registarFalhas('despesa', falhas, setAvisos)
          }),
        )
        guardar(
          await ouvirHeartbeats(casalId, ({ itens }) => {
            if (vivo) setHeartbeats(itens)
          }),
        )
      } catch (e) {
        if (vivo) setErro(mensagem(e))
      }
    })()

    return () => {
      vivo = false
      for (const c of cancelamentos) c()
    }
  }, [casalId])

  const valor = useMemo<EstadoApp>(() => {
    const eu = casal && utilizador ? pessoaDoUid(casal, utilizador.uid) : null
    const outra = casal && eu ? outraPessoa(casal, eu.id) : null

    let saldo: SaldoGlobal | null = null
    let erroSaldo: string | null = null
    if (eu && outra) {
      try {
        saldo = calcularSaldoGlobal(despesas, eventos, eu.id, outra.id)
      } catch (e) {
        // Dados inconsistentes não podem deitar a app abaixo: mostra-se o
        // problema e o resto da app continua a funcionar.
        erroSaldo = mensagem(e)
      }
    }

    return {
      utilizador,
      casalId,
      casal,
      eu,
      outra,
      eventos,
      despesas,
      heartbeats,
      saldo,
      alertas: casal ? alertasDeSaude(casal.pessoas, heartbeats, eventos, new Date()) : [],
      porTratar: despesas.filter((d) => d.estado === 'pendente'),
      carregando,
      erro: erro ?? erroSaldo,
      avisos,
    }
  }, [utilizador, casalId, casal, eventos, despesas, heartbeats, carregando, erro, avisos])

  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>
}

function mensagem(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function registarFalhas(
  tipo: string,
  falhas: { id: string; erro: string }[],
  setAvisos: (f: (a: string[]) => string[]) => void,
): void {
  if (falhas.length === 0) return
  const novos = falhas.map((f) => `${tipo} ${f.id}: ${f.erro}`)
  setAvisos((antigos) => [...new Set([...antigos, ...novos])])
}
