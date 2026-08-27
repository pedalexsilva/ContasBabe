import { useEffect, useState } from 'react'
import type { Navegacao } from '../App'
import { sair } from '../dados/auth'
import { ParserNativo, parserDisponivel } from '../dados/parserNativo'
import { useApp } from '../estado'

/**
 * Os três passos da primeira instalação, e o estado de cada um.
 *
 * Estão aqui e não num papel porque os dois primeiros falham em silêncio: sem
 * acesso a notificações a app não captura nada, sem exclusão da bateria o
 * Android mata o serviço, e em nenhum dos casos aparece um erro.
 */
export default function Configuracao({ nav }: { nav: Navegacao }) {
  const { eu, outra, casalId, heartbeats } = useApp()
  const [acesso, setAcesso] = useState<boolean | null>(null)
  const [corpus, setCorpus] = useState<{ linhas: number; bytes: number } | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const disponivel = parserDisponivel()

  useEffect(() => {
    if (!disponivel) return
    void ParserNativo.temAcessoNotificacoes().then((r) => setAcesso(r.autorizado)).catch(() => setAcesso(null))
    void ParserNativo.estadoCorpus().then(setCorpus).catch(() => setCorpus(null))
  }, [disponivel])

  const meuHeartbeat = heartbeats.find((h) => h.pessoaId === eu?.id)

  return (
    <>
      <h1>Configuração</h1>

      {!disponivel && (
        <p className="alerta">
          Estes controlos falam com o lado nativo. Neste browser não há nada do outro lado — abre na
          APK.
        </p>
      )}

      <h2>Primeira instalação</h2>

      <div className="cartao">
        <strong>
          1. Acesso a notificações{' '}
          {acesso === true ? '✓' : acesso === false ? '— em falta' : ''}
        </strong>
        <p className="fraco">
          É o que deixa a app <em>ler</em> as notificações do banco. Sem isto não se captura nada.
        </p>
        <button
          type="button"
          className={acesso === false ? 'principal' : ''}
          onClick={() => void ParserNativo.abrirDefinicoesNotificacoes()}
          disabled={!disponivel}
        >
          Abrir definições
        </button>
      </div>

      <div className="cartao">
        <strong>2. Otimização de bateria</strong>
        <p className="fraco">
          Sem excluir a app, o Android mata o serviço e a app fica cega sem avisar. Os fabricantes
          mais agressivos — a Samsung é dos piores — fazem-no em poucas horas.
        </p>
        <button
          type="button"
          onClick={() => void ParserNativo.abrirDefinicoesBateria()}
          disabled={!disponivel}
        >
          Abrir definições
        </button>
      </div>

      <div className="cartao">
        <strong>3. Quem és tu ✓</strong>
        <p className="fraco" style={{ marginBottom: 0 }}>
          {eu?.nome} nesta conta. A outra pessoa é {outra?.nome}. Casal <code>{casalId}</code>.
        </p>
      </div>

      <h2>Estado do serviço</h2>
      <div className="cartao">
        <p className="fraco" style={{ margin: 0 }}>
          {meuHeartbeat === undefined
            ? 'Este telemóvel ainda não deu sinal de vida. Se o passo 1 está feito, abre uma notificação qualquer do banco para o serviço arrancar.'
            : `Último sinal de vida: ${meuHeartbeat.vistoEm.toLocaleString('pt-PT')}. Última captura automática: ${meuHeartbeat.ultimaCapturaEm?.toLocaleString('pt-PT') ?? 'nunca'}.`}
        </p>
      </div>

      <h2>Corpus de notificações</h2>
      <div className="cartao">
        <p className="fraco">
          Tudo o que passa pelo listener fica registado num ficheiro. É o que permite escrever o
          parser da Wallet, que ainda não existe, e reparar os outros quando o banco mudar o texto —
          sem esperar por outra compra.
        </p>
        {corpus !== null && (
          <p className="fraco">
            {corpus.linhas} notificações registadas ({Math.round(corpus.bytes / 1024)} KB).
          </p>
        )}
        <div className="botoes">
          <button
            type="button"
            className="principal"
            disabled={!disponivel}
            onClick={() =>
              void ParserNativo.partilharCorpus().catch((e: unknown) =>
                setErro(e instanceof Error ? e.message : String(e)),
              )
            }
          >
            Exportar
          </button>
          <button type="button" onClick={() => nav.ir({ nome: 'debug' })}>
            Testar o parser
          </button>
          <button
            type="button"
            className="discreto"
            disabled={!disponivel}
            onClick={() => void ParserNativo.limparCorpus().then(() => setCorpus({ linhas: 0, bytes: 0 }))}
          >
            Limpar
          </button>
        </div>
      </div>

      {erro !== null && <p className="alerta">{erro}</p>}

      <div className="botoes" style={{ marginTop: 24 }}>
        <button type="button" className="discreto" onClick={() => void sair()}>
          Terminar sessão
        </button>
      </div>
    </>
  )
}
