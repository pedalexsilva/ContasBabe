import { useState } from 'react'
import type { Navegacao } from '../App'
import { criarEvento } from '../dados/firestore'
import { dataParaInput, inputParaData } from '../dominio/datas'
import { percentagensValidas } from '../dominio/eventos'
import { useApp } from '../estado'

export default function NovoEvento({ nav }: { nav: Navegacao }) {
  const { casalId, eu, outra } = useApp()
  const hoje = dataParaInput(new Date())

  const [nome, setNome] = useState('')
  const [inicio, setInicio] = useState(hoje)
  const [fim, setFim] = useState(hoje)
  const [percEu, setPercEu] = useState(50)
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (casalId === null || eu === null || outra === null) return null

  async function gravar() {
    if (casalId === null || eu === null || outra === null) return

    const dataInicio = inputParaData(inicio, 'inicio')
    const dataFim = inputParaData(fim, 'fim')

    if (nome.trim() === '') return setErro('Falta o nome do evento.')
    if (dataInicio === null || dataFim === null) return setErro('Datas inválidas.')
    if (dataFim < dataInicio) return setErro('O fim é anterior ao início.')

    const percentagens = { [eu.id]: percEu, [outra.id]: 100 - percEu }
    if (!percentagensValidas(percentagens, [eu.id, outra.id])) {
      return setErro('As percentagens têm de somar 100.')
    }

    setAGravar(true)
    setErro(null)
    try {
      const id = await criarEvento(casalId, {
        nome: nome.trim(),
        inicio: dataInicio,
        fim: dataFim,
        percentagens,
        fechadoEm: null,
        acertadoCent: null,
      })
      nav.ir({ nome: 'evento', id })
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setAGravar(false)
    }
  }

  return (
    <>
      <h1>Novo evento</h1>

      <label>
        Nome
        <input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Alentejo"
          autoFocus
        />
      </label>

      <div className="linha">
        <label>
          Início
          <input type="date" value={inicio} onChange={(e) => setInicio(e.target.value)} />
        </label>
        <label>
          Fim
          <input type="date" value={fim} onChange={(e) => setFim(e.target.value)} />
        </label>
      </div>

      <label>
        Divisão — {eu.nome} {percEu}% / {outra.nome} {100 - percEu}%
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={percEu}
          onChange={(e) => setPercEu(Number(e.target.value))}
        />
      </label>
      <p className="fraco">
        Aplica-se só ao bolo comum. Despesas marcadas como 100% de uma pessoa ficam de fora.
      </p>

      {erro !== null && <p className="alerta">{erro}</p>}

      <div className="botoes" style={{ marginTop: 16 }}>
        <button type="button" className="principal" onClick={() => void gravar()} disabled={aGravar}>
          {aGravar ? 'A criar…' : 'Criar evento'}
        </button>
        <button type="button" onClick={nav.voltar} disabled={aGravar}>
          Cancelar
        </button>
      </div>

      <p className="fraco" style={{ marginTop: 20 }}>
        Enquanto o evento estiver a decorrer, as compras capturadas nas notificações vão pedir
        confirmação. Até três dias depois do fim continuam a ser apanhadas, para os reembolsos não
        se perderem.
      </p>
    </>
  )
}
