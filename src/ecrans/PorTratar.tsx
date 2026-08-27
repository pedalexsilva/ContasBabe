import { useState } from 'react'
import type { Navegacao } from '../App'
import { confirmarDespesa, descartarDespesa } from '../dados/firestore'
import { formatarDataCurta } from '../dominio/datas'
import { formatarCent } from '../dominio/dinheiro'
import { eventosSugeridos } from '../dominio/eventos'
import { useApp } from '../estado'

/**
 * A caixa das capturas automáticas que ficaram sem confirmação — porque a
 * notificação passou despercebida, ou porque nenhum evento era óbvio.
 *
 * Os botões repetem os da notificação nativa de propósito: quem chega aqui pelo
 * lembrete das 21h30 quer despachar tudo de seguida, com os mesmos gestos.
 */
export default function PorTratar({ nav }: { nav: Navegacao }) {
  const { casalId, eu, outra, porTratar, eventos } = useApp()
  const [erro, setErro] = useState<string | null>(null)

  if (casalId === null || eu === null || outra === null) return null

  const nome = (id: string) => (id === eu.id ? eu.nome : outra.nome)

  async function tentar(acao: () => Promise<void>) {
    setErro(null)
    try {
      await acao()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <h1>Por tratar</h1>
      <p className="fraco">
        Capturadas nas notificações, ainda sem evento. Não contam para nenhum saldo enquanto
        estiverem aqui.
      </p>

      {erro !== null && <p className="alerta">{erro}</p>}

      {porTratar.length === 0 ? (
        <p className="vazio">Nada por tratar. </p>
      ) : (
        <ul className="lista">
          {porTratar.map((d) => {
            const sugeridos = eventosSugeridos(eventos, d.ocorreuEm)
            const outros = eventos.filter(
              (e) => e.fechadoEm === null && !sugeridos.some((s) => s.id === e.id),
            )

            return (
              <li key={d.id} className="cartao">
                <div className="item" style={{ border: 0, padding: 0 }}>
                  <span>
                    <strong>{d.comerciante ?? d.descricao ?? 'Compra sem comerciante'}</strong>
                    <div className="fraco">
                      {nome(d.pagouId)} · {formatarDataCurta(d.ocorreuEm)} · {d.origem}
                      {d.cartaoLast4 !== null && ` · cartão ${d.cartaoLast4}`}
                    </div>
                  </span>
                  <span className="valor">{formatarCent(d.valorCent)}</span>
                </div>

                <div className="botoes" style={{ marginTop: 12 }}>
                  {sugeridos.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className="principal"
                      onClick={() => void tentar(() => confirmarDespesa(casalId, d.id, e.id))}
                    >
                      {e.nome}
                    </button>
                  ))}
                  {outros.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      onClick={() => void tentar(() => confirmarDespesa(casalId, d.id, e.id))}
                    >
                      {e.nome}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => void tentar(() => descartarDespesa(casalId, d.id))}
                  >
                    Não é da viagem
                  </button>
                </div>

                {sugeridos.length === 0 && outros.length === 0 && (
                  <p className="fraco" style={{ marginTop: 8, marginBottom: 0 }}>
                    Não há nenhum evento aberto para lhe atribuir.{' '}
                    <button
                      type="button"
                      className="discreto"
                      onClick={() => nav.ir({ nome: 'novo-evento' })}
                    >
                      Criar um
                    </button>
                  </p>
                )}

                {d.rawText !== null && (
                  <details style={{ marginTop: 8 }}>
                    <summary className="fraco">Texto da notificação</summary>
                    <pre className="raw">{d.rawText}</pre>
                  </details>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
