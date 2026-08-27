import type { Navegacao } from '../App'
import { formatarPeriodo } from '../dominio/datas'
import { formatarCent } from '../dominio/dinheiro'
import { estaAtivo } from '../dominio/eventos'
import { useApp } from '../estado'

export default function Eventos({ nav }: { nav: Navegacao }) {
  const { eventos, saldo } = useApp()
  const agora = new Date()

  return (
    <>
      <h1>Eventos</h1>

      <div className="botoes" style={{ margin: '12px 0 20px' }}>
        <button type="button" className="principal" onClick={() => nav.ir({ nome: 'novo-evento' })}>
          + Novo evento
        </button>
      </div>

      {eventos.length === 0 ? (
        <p className="vazio">
          Ainda não há eventos. Um evento é uma viagem, um fim de semana, um período qualquer com
          princípio e fim.
        </p>
      ) : (
        <ul className="lista">
          {eventos.map((e) => {
            const s = saldo?.porEvento.find((x) => x.eventoId === e.id)
            return (
              <li key={e.id} className="item">
                <button
                  type="button"
                  onClick={() => nav.ir({ nome: 'evento', id: e.id })}
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    border: 0,
                    background: 'transparent',
                    padding: 0,
                  }}
                >
                  <strong>{e.nome}</strong>
                  {e.fechadoEm !== null ? (
                    <span className="etiqueta">acertado</span>
                  ) : estaAtivo(e, agora) ? (
                    <span className="etiqueta aberto">a decorrer</span>
                  ) : null}
                  <div className="fraco">{formatarPeriodo(e.inicio, e.fim)}</div>
                </button>
                <span className="valor">
                  {e.fechadoEm !== null && e.acertadoCent !== null
                    ? formatarCent(e.acertadoCent)
                    : s
                      ? formatarCent(s.totalCent)
                      : ''}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
