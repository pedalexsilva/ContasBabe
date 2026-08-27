import { useEffect, useState } from 'react'
import {
  ParserNativo,
  parserDisponivel,
  type ResultadoParse,
} from '../dados/parserNativo'
import { formatarCent } from '../dominio/dinheiro'

/**
 * Cola-se o texto de uma notificação e vê-se exatamente o que o parser extraiu.
 *
 * É o ecrã que evita ter de ir pagar um café para testar uma alteração de
 * formato: quando o banco mudar uma palavra, cola-se o texto novo aqui.
 */

const EXEMPLOS = [
  {
    etiqueta: 'Santander — compra',
    pacote: 'pt.santandertotta.mobileapp',
    titulo: 'Santander',
    texto: 'Movimento no valor de EUR 0,95 no cartão ***********0390',
  },
  {
    etiqueta: 'Santander — 3D Secure (deve ser ignorado)',
    pacote: 'pt.santandertotta.mobileapp',
    titulo: 'Santander',
    texto: 'Autorize a compra no valor de EUR 24,99 com o código 481923',
  },
  {
    etiqueta: 'MB Way — compra QR',
    pacote: 'pt.sibs.android.mbway',
    titulo: 'Compra QRCode',
    texto: 'Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.',
  },
]

export default function Debug() {
  const [pacote, setPacote] = useState(EXEMPLOS[0]?.pacote ?? '')
  const [titulo, setTitulo] = useState(EXEMPLOS[0]?.titulo ?? '')
  const [texto, setTexto] = useState(EXEMPLOS[0]?.texto ?? '')
  const [resultado, setResultado] = useState<ResultadoParse | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [pacotes, setPacotes] = useState<{ origem: string; pacote: string }[]>([])

  const disponivel = parserDisponivel()

  useEffect(() => {
    if (!disponivel) return
    void ParserNativo.pacotesConhecidos()
      .then((r) => setPacotes(r.pacotes))
      .catch(() => setPacotes([]))
  }, [disponivel])

  async function analisar() {
    setErro(null)
    setResultado(null)
    try {
      setResultado(await ParserNativo.analisar({ pacote, titulo, texto }))
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <h1>Parser de notificações</h1>

      {!disponivel && (
        <p className="alerta">
          O parser vive em Kotlin, dentro da app Android. Neste browser não há nada do outro lado da
          ponte — abre este ecrã na APK.
        </p>
      )}

      <h2>Exemplos</h2>
      <div className="botoes">
        {EXEMPLOS.map((ex) => (
          <button
            key={ex.etiqueta}
            type="button"
            onClick={() => {
              setPacote(ex.pacote)
              setTitulo(ex.titulo)
              setTexto(ex.texto)
              setResultado(null)
            }}
          >
            {ex.etiqueta}
          </button>
        ))}
      </div>

      <label style={{ marginTop: 16 }}>
        Pacote
        <input value={pacote} onChange={(e) => setPacote(e.target.value)} />
      </label>
      {pacotes.length > 0 && (
        <p className="fraco">
          Reconhecidos: {pacotes.map((p) => `${p.origem} (${p.pacote})`).join(', ')}
        </p>
      )}

      <label>
        Título
        <input value={titulo} onChange={(e) => setTitulo(e.target.value)} />
      </label>

      <label>
        Texto
        <input value={texto} onChange={(e) => setTexto(e.target.value)} />
      </label>

      <div className="botoes">
        <button type="button" className="principal" onClick={() => void analisar()} disabled={!disponivel}>
          Analisar
        </button>
      </div>

      {erro !== null && <p className="alerta">{erro}</p>}

      {resultado !== null && (
        <div className="cartao" style={{ marginTop: 16 }}>
          {resultado.reconhecido ? (
            <>
              <p className="fraco">Reconhecido como {resultado.origem}</p>
              <p className="saldo-grande">
                {resultado.valorCent === null ? '—' : formatarCent(resultado.valorCent)}
              </p>
              <ul className="lista">
                <li className="item">
                  <span className="fraco">Comerciante</span>
                  <span>{resultado.comerciante ?? '— (não vem no texto)'}</span>
                </li>
                <li className="item">
                  <span className="fraco">Cartão</span>
                  <span>{resultado.cartaoLast4 ?? '—'}</span>
                </li>
              </ul>
            </>
          ) : (
            <>
              <strong>Não reconhecido</strong>
              <p className="fraco" style={{ marginBottom: 0 }}>
                {resultado.motivo ??
                  'Nenhum parser aceitou este pacote, ou o texto não bateu certo com a estrutura completa.'}
              </p>
            </>
          )}
        </div>
      )}
    </>
  )
}
