import { Component, type ErrorInfo, type ReactNode } from 'react'

/**
 * Rede de segurança à volta dos ecrãs.
 *
 * O domínio faz `throw` em vez de assumir valores por omissão: uma despesa com
 * um pagador desconhecido, ou um evento sem percentagem definida, param a conta
 * em vez de a darem errada em silêncio. Essa é a escolha certa — mas sem isto,
 * um único documento corrompido deitava a app inteira abaixo para um ecrã
 * branco, sem dizer o que se passou.
 */
export class Fronteira extends Component<
  { children: ReactNode },
  { erro: Error | null }
> {
  override state: { erro: Error | null } = { erro: null }

  static getDerivedStateFromError(erro: Error) {
    return { erro }
  }

  override componentDidCatch(erro: Error, info: ErrorInfo) {
    console.error('[fronteira] ecrã rebentou', erro, info.componentStack)
  }

  override render() {
    if (this.state.erro === null) return this.props.children

    return (
      <div className="cartao">
        <h1>Alguma coisa correu mal neste ecrã</h1>
        <p className="fraco">{this.state.erro.message}</p>
        <p className="fraco">
          O resto da app continua a funcionar. Se a mensagem falar de uma despesa ou de um evento,
          é esse registo que está inconsistente.
        </p>
        <div className="botoes">
          <button type="button" className="principal" onClick={() => this.setState({ erro: null })}>
            Tentar outra vez
          </button>
        </div>
      </div>
    )
  }
}
