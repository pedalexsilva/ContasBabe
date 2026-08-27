import type { Evento, Heartbeat, Pessoa } from '../tipos'
import { estaAtivo } from './eventos'

/**
 * Os dois modos de falha silenciosa do plano, transformados em avisos.
 *
 * Ambos partilham a mesma característica desagradável: quando acontecem, a app
 * continua a parecer perfeitamente bem. Não há erro, não há ecrã vermelho — só
 * despesas que deixam de aparecer. Por isso é a própria app que tem de reparar.
 */

const HORA_MS = 60 * 60 * 1000
const DIA_MS = 24 * HORA_MS

/** Fabricantes agressivos com bateria matam o serviço sem avisar ninguém. */
export const LIMITE_SERVICO_MORTO_MS = 24 * HORA_MS

/** Uma atualização do banco muda uma palavra e o parser deixa de bater certo. */
export const LIMITE_PARSER_MUDO_MS = 7 * DIA_MS

export type TipoAlerta = 'servico-morto' | 'parser-mudo' | 'sem-heartbeat'

export interface Alerta {
  tipo: TipoAlerta
  pessoaId: string
  /** Nome da pessoa, para a mensagem poder ser lida por quem não é ela. */
  nome: string
  mensagem: string
  desdeMs: number
}

function horasOuDias(ms: number): string {
  if (ms < DIA_MS) return `${Math.floor(ms / HORA_MS)} horas`
  const dias = Math.floor(ms / DIA_MS)
  return dias === 1 ? '1 dia' : `${dias} dias`
}

/**
 * O heartbeat vive no Firestore e não no telemóvel de cada um por uma razão
 * concreta: o telemóvel da Lisa com o serviço morto é invisível para a Lisa,
 * mas o Pedro abre a app e vê. Por isso os alertas são sempre de todo o casal.
 */
export function alertasDeSaude(
  pessoas: Pessoa[],
  heartbeats: Heartbeat[],
  eventos: Evento[],
  agora: Date,
): Alerta[] {
  const haEventoAtivo = eventos.some((e) => estaAtivo(e, agora))
  const alertas: Alerta[] = []

  for (const pessoa of pessoas) {
    const hb = heartbeats.find((h) => h.pessoaId === pessoa.id)

    if (!hb) {
      alertas.push({
        tipo: 'sem-heartbeat',
        pessoaId: pessoa.id,
        nome: pessoa.nome,
        mensagem: `${pessoa.nome} ainda não deu sinal de vida. Falta dar acesso a notificações no telemóvel dele?`,
        desdeMs: 0,
      })
      continue
    }

    const desdeVisto = agora.getTime() - hb.vistoEm.getTime()
    if (desdeVisto > LIMITE_SERVICO_MORTO_MS) {
      alertas.push({
        tipo: 'servico-morto',
        pessoaId: pessoa.id,
        nome: pessoa.nome,
        mensagem: `O serviço no telemóvel de ${pessoa.nome} está calado há ${horasOuDias(desdeVisto)}. Verifica a otimização de bateria.`,
        desdeMs: desdeVisto,
      })
      continue
    }

    // Só faz sentido enquanto há alguma coisa para capturar: fora de viagem,
    // dias sem capturas é o comportamento normal, não uma avaria.
    if (!haEventoAtivo) continue

    const desdeCaptura =
      hb.ultimaCapturaEm === null ? Number.POSITIVE_INFINITY : agora.getTime() - hb.ultimaCapturaEm.getTime()

    if (desdeCaptura > LIMITE_PARSER_MUDO_MS) {
      alertas.push({
        tipo: 'parser-mudo',
        pessoaId: pessoa.id,
        nome: pessoa.nome,
        mensagem:
          hb.ultimaCapturaEm === null
            ? `Nunca houve uma captura automática no telemóvel de ${pessoa.nome}, e há um evento a decorrer.`
            : `Sem capturas automáticas de ${pessoa.nome} há ${horasOuDias(desdeCaptura)}, com um evento a decorrer. O texto das notificações pode ter mudado.`,
        desdeMs: desdeCaptura === Number.POSITIVE_INFINITY ? 0 : desdeCaptura,
      })
    }
  }

  return alertas
}
