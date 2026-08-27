import { useState } from 'react'
import type { Navegacao } from '../App'
import { anosComEventos, resumoAnual } from '../dominio/dashboard'
import { formatarCent } from '../dominio/dinheiro'
import { useApp } from '../estado'

export default function Dashboard({ nav }: { nav: Navegacao }) {
  const { eu, outra, eventos, despesas } = useApp()
  const anos = anosComEventos(eventos)
  const [escolhido, setAno] = useState<number | null>(null)

  // Os eventos chegam do Firestore depois do primeiro render. Guardar o ano no
  // estado logo à partida deixava o ecrã preso no ano corrente, vazio, mesmo
  // com todas as viagens noutro ano.
  const ano = escolhido !== null && anos.includes(escolhido)
    ? escolhido
    : (anos[0] ?? new Date().getFullYear())

  if (eu === null || outra === null) return null

  const r = resumoAnual(despesas, eventos, ano, eu.id, outra.id)
  const maior = Math.max(1, ...r.eventos.map((e) => e.totalCent))
  const nome = (id: string) => (id === eu.id ? eu.nome : outra.nome)

  return (
    <>
      <h1>{ano}</h1>

      {anos.length > 1 && (
        <div className="botoes" style={{ marginBottom: 12 }}>
          {anos.map((a) => (
            <button
              key={a}
              type="button"
              className={a === ano ? 'principal' : ''}
              onClick={() => setAno(a)}
            >
              {a}
            </button>
          ))}
        </div>
      )}

      <div className="cartao">
        <p className="fraco">Total do ano</p>
        <p className="saldo-grande">{formatarCent(r.totalCent)}</p>
        {r.totalAbertoCent !== 0 && (
          <p className="fraco" style={{ margin: 0 }}>
            {formatarCent(r.totalAbertoCent)} vêm de eventos ainda abertos — este número ainda vai
            mudar.
          </p>
        )}
      </div>

      {r.eventos.length === 0 ? (
        <p className="vazio">Sem eventos em {ano}.</p>
      ) : (
        <>
          <h2>Onde foi o dinheiro</h2>
          <ul className="lista">
            {r.eventos.map((e) => (
              <li key={e.eventoId} style={{ padding: '10px 0' }}>
                <button
                  type="button"
                  onClick={() => nav.ir({ nome: 'evento', id: e.eventoId })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                  }}
                >
                  <div className="item" style={{ border: 0, padding: 0 }}>
                    <span>
                      {e.nome}
                      {e.aberto && <span className="etiqueta aberto">aberto</span>}
                    </span>
                    <span className="valor">{formatarCent(e.totalCent)}</span>
                  </div>
                  <div
                    className="barra"
                    style={{ width: `${Math.round((e.totalCent / maior) * 100)}%` }}
                  />
                  <div className="fraco">
                    {formatarCent(e.custoPorDiaCent)} por dia · {e.dias}{' '}
                    {e.dias === 1 ? 'dia' : 'dias'}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <h2>Gastos individuais</h2>
      <ul className="lista">
        {r.pessoais.map((p) => (
          <li key={p.pessoaId} className="item">
            <span className="fraco">{nome(p.pessoaId)}</span>
            <span className="valor">{formatarCent(p.pessoaisCent)}</span>
          </li>
        ))}
      </ul>
      <p className="fraco">
        Só o que foi marcado como 100% de cada um. O resto é partilhado por definição.
      </p>

      <div className="botoes" style={{ marginTop: 24 }}>
        <button type="button" className="discreto" onClick={() => nav.ir({ nome: 'debug' })}>
          Testar o parser de notificações
        </button>
      </div>
    </>
  )
}
