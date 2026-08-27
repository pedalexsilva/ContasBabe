import type { Navegacao } from '../App'
import { formatarCent } from '../dominio/dinheiro'
import { estaAtivo } from '../dominio/eventos'
import { formatarPeriodo } from '../dominio/datas'
import { useApp } from '../estado'

/**
 * Ecrã inicial: quem deve a quem, e o que está por tratar. Nada mais — é o que
 * se abre a app para saber.
 */
export default function Inicio({ nav }: { nav: Navegacao }) {
  const { eu, outra, saldo, alertas, porTratar, eventos } = useApp()
  if (eu === null || outra === null || saldo === null) return null

  const agora = new Date()
  const ativos = eventos.filter((e) => estaAtivo(e, agora))
  const nome = (id: string) => (id === eu.id ? eu.nome : outra.nome)

  return (
    <>
      {alertas.map((a) => (
        <p className="alerta" key={`${a.tipo}-${a.pessoaId}`}>
          {a.mensagem}
        </p>
      ))}

      <div className="cartao">
        {saldo.devedorId === null ? (
          <>
            <p className="fraco">Saldo</p>
            <p className="saldo-grande">Estão quites</p>
          </>
        ) : (
          <>
            <p className="fraco">
              {saldo.devedorId === eu.id ? 'Deves a' : 'Tens a receber de'}{' '}
              {nome(saldo.devedorId === eu.id ? outra.id : saldo.devedorId)}
            </p>
            <p className={`saldo-grande ${saldo.devedorId === eu.id ? 'deve' : 'recebe'}`}>
              {formatarCent(saldo.montanteCent)}
            </p>
          </>
        )}
        <p className="fraco">
          {saldo.porEvento.length === 0
            ? 'Sem eventos abertos.'
            : `Somado de ${saldo.porEvento.length} evento${saldo.porEvento.length === 1 ? '' : 's'} aberto${saldo.porEvento.length === 1 ? '' : 's'}.`}
        </p>
      </div>

      {porTratar.length > 0 && (
        <button
          type="button"
          className="cartao"
          style={{ width: '100%', textAlign: 'left' }}
          onClick={() => nav.ir({ nome: 'por-tratar' })}
        >
          <strong>
            {porTratar.length} {porTratar.length === 1 ? 'despesa' : 'despesas'} por tratar
          </strong>
          <p className="fraco" style={{ margin: '4px 0 0' }}>
            Capturadas automaticamente, à espera de saber a que evento pertencem.
          </p>
        </button>
      )}

      <h2>A decorrer</h2>
      {ativos.length === 0 ? (
        <div className="cartao">
          <p className="fraco" style={{ margin: 0 }}>
            Nenhum evento a decorrer. Sem um evento aberto, as capturas automáticas ficam desligadas.
          </p>
          <div className="botoes" style={{ marginTop: 12 }}>
            <button type="button" className="principal" onClick={() => nav.ir({ nome: 'novo-evento' })}>
              Criar evento
            </button>
          </div>
        </div>
      ) : (
        <ul className="lista">
          {ativos.map((e) => {
            const s = saldo.porEvento.find((x) => x.eventoId === e.id)
            return (
              <li key={e.id} className="cartao" style={{ padding: 0 }}>
                <button
                  type="button"
                  onClick={() => nav.ir({ nome: 'evento', id: e.id })}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    background: 'transparent',
                    padding: 16,
                  }}
                >
                  <strong>{e.nome}</strong>
                  <div className="fraco">{formatarPeriodo(e.inicio, e.fim)}</div>
                  {s && (
                    <div className="fraco" style={{ marginTop: 4 }}>
                      {formatarCent(s.totalCent)} gastos ·{' '}
                      {s.devedorId === null
                        ? 'quites'
                        : `${nome(s.devedorId)} deve ${formatarCent(s.montanteCent)}`}
                    </div>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      )}

      <div className="botoes" style={{ marginTop: 16 }}>
        <button
          type="button"
          className="principal"
          onClick={() => nav.ir({ nome: 'nova-despesa', eventoId: ativos[0]?.id ?? null })}
        >
          + Registar despesa
        </button>
      </div>
    </>
  )
}
