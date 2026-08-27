import { useState } from 'react'
import type { Navegacao } from '../App'
import { criarDespesa } from '../dados/firestore'
import { dataParaInput, inputParaData } from '../dominio/datas'
import { parseCent } from '../dominio/dinheiro'
import { estaAtivo } from '../dominio/eventos'
import { useApp } from '../estado'

export default function NovaDespesa({
  eventoId,
  nav,
}: {
  eventoId: string | null
  nav: Navegacao
}) {
  const { casalId, eu, outra, eventos } = useApp()
  const agora = new Date()

  const disponiveis = eventos.filter((e) => e.fechadoEm === null)
  const [evento, setEvento] = useState(eventoId ?? disponiveis.find((e) => estaAtivo(e, agora))?.id ?? '')
  const [valor, setValor] = useState('')
  const [descricao, setDescricao] = useState('')
  const [pagou, setPagou] = useState(eu?.id ?? '')
  const [soMinha, setSoMinha] = useState(false)
  const [reembolso, setReembolso] = useState(false)
  const [data, setData] = useState(dataParaInput(agora))
  const [aGravar, setAGravar] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  if (casalId === null || eu === null || outra === null) return null

  const cent = parseCent(valor)

  async function gravar() {
    if (casalId === null) return
    if (cent === null || cent === 0) return setErro('Valor inválido.')
    if (evento === '') return setErro('Escolhe um evento.')

    const quando = inputParaData(data, 'inicio')
    if (quando === null) return setErro('Data inválida.')

    setAGravar(true)
    setErro(null)
    try {
      await criarDespesa(casalId, {
        eventoId: evento,
        pagouId: pagou,
        valorCent: reembolso ? -cent : cent,
        descricao: descricao.trim() === '' ? null : descricao.trim(),
        comerciante: null,
        soMinha,
        origem: 'manual',
        cartaoLast4: null,
        rawText: null,
        // Hora de agora com a data escolhida: a ordenação da lista fica certa
        // mesmo quando se registam várias despesas do mesmo dia de seguida.
        ocorreuEm: new Date(
          quando.getFullYear(),
          quando.getMonth(),
          quando.getDate(),
          agora.getHours(),
          agora.getMinutes(),
          agora.getSeconds(),
        ),
        estado: 'confirmada',
      })
      nav.voltar()
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
      setAGravar(false)
    }
  }

  return (
    <>
      <h1>{reembolso ? 'Registar reembolso' : 'Registar despesa'}</h1>

      <label>
        Valor
        <input
          inputMode="decimal"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          placeholder="12,50"
          autoFocus
        />
      </label>

      <label>
        Descrição
        <input
          value={descricao}
          onChange={(e) => setDescricao(e.target.value)}
          placeholder="Jantar"
        />
      </label>

      <label>
        Evento
        <select value={evento} onChange={(e) => setEvento(e.target.value)}>
          <option value="">— escolher —</option>
          {disponiveis.map((e) => (
            <option key={e.id} value={e.id}>
              {e.nome}
              {estaAtivo(e, agora) ? ' (a decorrer)' : ''}
            </option>
          ))}
        </select>
      </label>

      <label>
        Quem pagou
        <select value={pagou} onChange={(e) => setPagou(e.target.value)}>
          <option value={eu.id}>{eu.nome}</option>
          <option value={outra.id}>{outra.nome}</option>
        </select>
      </label>

      <label>
        Data
        <input type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={soMinha}
          onChange={(e) => setSoMinha(e.target.checked)}
          style={{ width: 'auto', margin: 0, minHeight: 0 }}
        />
        100% de quem pagou — fica fora da divisão
      </label>

      <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="checkbox"
          checked={reembolso}
          onChange={(e) => setReembolso(e.target.checked)}
          style={{ width: 'auto', margin: 0, minHeight: 0 }}
        />
        É um reembolso — entra como valor negativo
      </label>

      {erro !== null && <p className="alerta">{erro}</p>}

      <div className="botoes" style={{ marginTop: 16 }}>
        <button type="button" className="principal" onClick={() => void gravar()} disabled={aGravar}>
          {aGravar ? 'A gravar…' : 'Gravar'}
        </button>
        <button type="button" onClick={nav.voltar} disabled={aGravar}>
          Cancelar
        </button>
      </div>
    </>
  )
}
