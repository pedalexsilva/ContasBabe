import { useState } from 'react'
import type { Navegacao } from '../App'
import { apagarDespesa, atualizarDespesa, fecharEvento, reabrirEvento } from '../dados/firestore'
import { formatarDataCurta, formatarPeriodo } from '../dominio/datas'
import { formatarCent } from '../dominio/dinheiro'
import { duracaoDias, percentagemDe } from '../dominio/eventos'
import { calcularSaldo } from '../dominio/saldo'
import { useApp } from '../estado'

export default function EcraEvento({ eventoId, nav }: { eventoId: string; nav: Navegacao }) {
  const { casalId, eu, outra, eventos, despesas } = useApp()
  const [aFechar, setAFechar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const evento = eventos.find((e) => e.id === eventoId)
  if (casalId === null || eu === null || outra === null || evento === undefined) {
    return <p className="vazio">Evento não encontrado.</p>
  }

  const saldo = calcularSaldo(despesas, {
    eventoId,
    pessoaA: eu.id,
    pessoaB: outra.id,
    percA: percentagemDe(evento, eu.id),
  })

  const doEvento = despesas
    .filter((d) => d.eventoId === eventoId && d.estado === 'confirmada')
    .sort((a, b) => b.ocorreuEm.getTime() - a.ocorreuEm.getTime())

  const nome = (id: string) => (id === eu.id ? eu.nome : outra.nome)
  const fechado = evento.fechadoEm !== null

  async function alternarFecho() {
    if (casalId === null) return
    setAFechar(true)
    setErro(null)
    try {
      if (fechado) await reabrirEvento(casalId, eventoId)
      else await fecharEvento(casalId, eventoId, saldo.montanteCent)
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    } finally {
      setAFechar(false)
    }
  }

  return (
    <>
      <h1>
        {evento.nome}
        {fechado && <span className="etiqueta">acertado</span>}
      </h1>
      <p className="fraco">
        {formatarPeriodo(evento.inicio, evento.fim)} · {duracaoDias(evento)} dias
      </p>

      <div className="cartao">
        {saldo.devedorId === null ? (
          <p className="saldo-grande">Estão quites</p>
        ) : (
          <>
            <p className="fraco">
              {nome(saldo.devedorId)} deve a {nome(saldo.credorId ?? '')}
            </p>
            <p className={`saldo-grande ${saldo.devedorId === eu.id ? 'deve' : 'recebe'}`}>
              {formatarCent(saldo.montanteCent)}
            </p>
          </>
        )}

        <ul className="lista" style={{ marginTop: 12 }}>
          {[saldo.a, saldo.b].map((p) => (
            <li key={p.pessoaId} className="item">
              <span>
                {nome(p.pessoaId)}
                <div className="fraco">
                  pagou {formatarCent(p.pagouCent)}
                  {p.pessoaisCent !== 0 && `, ${formatarCent(p.pessoaisCent)} só dele`} · devia{' '}
                  {formatarCent(p.deviaCent)}
                </div>
              </span>
              <span className={`valor ${p.saldoCent < 0 ? 'deve' : 'recebe'}`}>
                {p.saldoCent > 0 ? '+' : ''}
                {formatarCent(p.saldoCent)}
              </span>
            </li>
          ))}
        </ul>

        <p className="fraco" style={{ marginTop: 8, marginBottom: 0 }}>
          {formatarCent(saldo.totalCent)} no total · {formatarCent(saldo.comumCent)} em comum ·{' '}
          {formatarCent(Math.round(saldo.totalCent / duracaoDias(evento)))} por dia
        </p>
      </div>

      {!fechado && (
        <div className="botoes">
          <button
            type="button"
            className="principal"
            onClick={() => nav.ir({ nome: 'nova-despesa', eventoId })}
          >
            + Despesa
          </button>
          <button type="button" onClick={() => void alternarFecho()} disabled={aFechar}>
            Marcar como acertado
          </button>
        </div>
      )}

      {fechado && (
        <div className="botoes">
          <button type="button" onClick={() => void alternarFecho()} disabled={aFechar}>
            Reabrir evento
          </button>
        </div>
      )}

      {erro !== null && <p className="alerta">{erro}</p>}

      <h2>
        {doEvento.length} {doEvento.length === 1 ? 'despesa' : 'despesas'}
      </h2>

      {doEvento.length === 0 ? (
        <p className="vazio">Ainda sem despesas neste evento.</p>
      ) : (
        <ul className="lista">
          {doEvento.map((d) => (
            <li key={d.id} className="item">
              <span>
                {d.descricao ?? d.comerciante ?? 'Sem descrição'}
                {d.soMinha && <span className="etiqueta">100% {nome(d.pagouId)}</span>}
                {d.origem !== 'manual' && <span className="etiqueta">{d.origem}</span>}
                <div className="fraco">
                  {nome(d.pagouId)} · {formatarDataCurta(d.ocorreuEm)}
                </div>
                {!fechado && (
                  <div className="botoes" style={{ marginTop: 6 }}>
                    <button
                      type="button"
                      className="discreto"
                      onClick={() => void atualizarDespesa(casalId, d.id, { soMinha: !d.soMinha })}
                    >
                      {d.soMinha ? 'Passar a comum' : 'Marcar 100% minha'}
                    </button>
                    <button
                      type="button"
                      className="discreto"
                      onClick={() => void apagarDespesa(casalId, d.id)}
                    >
                      Apagar
                    </button>
                  </div>
                )}
              </span>
              <span className={`valor ${d.valorCent < 0 ? 'recebe' : ''}`}>
                {formatarCent(d.valorCent)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
