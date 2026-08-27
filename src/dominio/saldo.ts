import type { Despesa, Evento, PessoaId } from '../tipos'
import { percentagemDe } from './eventos'

/**
 * Cálculo de saldos. Função pura: não conhece Firestore, não conhece React.
 * A UI nunca replica esta aritmética — chama daqui.
 *
 * Tudo em cêntimos inteiros. O único ponto onde entra um número fracionário é
 * a percentagem do evento, e o resultado é imediatamente arredondado.
 */

export interface OpcoesSaldo {
  eventoId: string
  pessoaA: PessoaId
  pessoaB: PessoaId
  /** Percentagem do bolo comum que cabe a `pessoaA` (0–100). */
  percA: number
}

export interface SaldoPessoa {
  pessoaId: PessoaId
  /** Tudo o que esta pessoa desembolsou no evento, pessoais incluídos. */
  pagouCent: number
  /** O que desembolsou e marcou como 100% seu. */
  pessoaisCent: number
  /** O que entrou no bolo comum: `pagou - pessoais`. */
  contribuiuCent: number
  /** A parte do bolo comum que lhe cabia, pela percentagem do evento. */
  deviaCent: number
  /** `contribuiu - devia`. Positivo = tem a receber. */
  saldoCent: number
}

export interface SaldoEvento {
  eventoId: string
  /** Soma das contribuições das duas pessoas: o que é para dividir. */
  comumCent: number
  /** Tudo o que se gastou no evento, comum e pessoal. */
  totalCent: number
  a: SaldoPessoa
  b: SaldoPessoa
  /** `null` quando estão quites. */
  devedorId: PessoaId | null
  credorId: PessoaId | null
  /** Quanto o devedor tem a pagar ao credor. Nunca negativo. */
  montanteCent: number
  /** Quantas despesas confirmadas entraram na conta. */
  numeroDespesas: number
}

/**
 * Arredonda meio-cêntimo para longe do zero, para que negar todas as despesas
 * negue exatamente o saldo. `Math.round` não tem essa simetria: arredonda
 * −2,5 para −2 e 2,5 para 3.
 */
function arredondar(x: number): number {
  return x < 0 ? -Math.round(-x) : Math.round(x)
}

export function calcularSaldo(despesas: Despesa[], opts: OpcoesSaldo): SaldoEvento {
  const { eventoId, pessoaA, pessoaB, percA } = opts

  if (pessoaA === pessoaB) {
    throw new Error('calcularSaldo: as duas pessoas do casal têm de ser diferentes')
  }
  if (!Number.isFinite(percA) || percA < 0 || percA > 100) {
    throw new Error(`calcularSaldo: percentagem fora de 0–100: ${percA}`)
  }

  const doEvento = despesas.filter((d) => d.estado === 'confirmada' && d.eventoId === eventoId)

  let pagouA = 0
  let pagouB = 0
  let pessoaisA = 0
  let pessoaisB = 0

  for (const d of doEvento) {
    if (d.pagouId === pessoaA) {
      pagouA += d.valorCent
      if (d.soMinha) pessoaisA += d.valorCent
    } else if (d.pagouId === pessoaB) {
      pagouB += d.valorCent
      if (d.soMinha) pessoaisB += d.valorCent
    } else {
      // Silenciar isto perderia dinheiro sem deixar rasto — num casal de duas
      // pessoas, um terceiro pagador é sempre um bug.
      throw new Error(
        `calcularSaldo: despesa ${d.id} tem pagouId "${d.pagouId}", que não é "${pessoaA}" nem "${pessoaB}"`,
      )
    }
  }

  const contribuiuA = pagouA - pessoaisA
  const contribuiuB = pagouB - pessoaisB
  const comumCent = contribuiuA + contribuiuB

  // Arredonda-se um só lado e o outro sai por diferença: numa divisão 60/40 de
  // um valor ímpar, é o que garante que não se perde nem se inventa um cêntimo.
  const deviaA = arredondar((comumCent * percA) / 100)
  const deviaB = comumCent - deviaA

  const saldoA = contribuiuA - deviaA
  const saldoB = contribuiuB - deviaB

  const a: SaldoPessoa = {
    pessoaId: pessoaA,
    pagouCent: pagouA,
    pessoaisCent: pessoaisA,
    contribuiuCent: contribuiuA,
    deviaCent: deviaA,
    saldoCent: saldoA,
  }
  const b: SaldoPessoa = {
    pessoaId: pessoaB,
    pagouCent: pagouB,
    pessoaisCent: pessoaisB,
    contribuiuCent: contribuiuB,
    deviaCent: deviaB,
    saldoCent: saldoB,
  }

  let devedorId: PessoaId | null = null
  let credorId: PessoaId | null = null
  if (saldoA < 0) {
    devedorId = pessoaA
    credorId = pessoaB
  } else if (saldoB < 0) {
    devedorId = pessoaB
    credorId = pessoaA
  }

  return {
    eventoId,
    comumCent,
    totalCent: pagouA + pagouB,
    a,
    b,
    devedorId,
    credorId,
    montanteCent: Math.abs(saldoA),
    numeroDespesas: doEvento.length,
  }
}

export interface SaldoGlobal {
  /** Saldo acumulado da primeira pessoa em todos os eventos considerados. */
  saldoACent: number
  devedorId: PessoaId | null
  credorId: PessoaId | null
  montanteCent: number
  porEvento: SaldoEvento[]
}

/**
 * O número do ecrã inicial: com vários eventos ao mesmo tempo, é o único que
 * responde a "quem deve a quem, agora". Os eventos já fechados não entram —
 * foram acertados.
 */
export function calcularSaldoGlobal(
  despesas: Despesa[],
  eventos: Evento[],
  pessoaA: PessoaId,
  pessoaB: PessoaId,
): SaldoGlobal {
  const porEvento = eventos
    .filter((e) => e.fechadoEm === null)
    .map((e) =>
      calcularSaldo(despesas, {
        eventoId: e.id,
        pessoaA,
        pessoaB,
        percA: percentagemDe(e, pessoaA),
      }),
    )

  const saldoACent = porEvento.reduce((soma, s) => soma + s.a.saldoCent, 0)

  return {
    saldoACent,
    devedorId: saldoACent < 0 ? pessoaA : saldoACent > 0 ? pessoaB : null,
    credorId: saldoACent < 0 ? pessoaB : saldoACent > 0 ? pessoaA : null,
    montanteCent: Math.abs(saldoACent),
    porEvento,
  }
}
