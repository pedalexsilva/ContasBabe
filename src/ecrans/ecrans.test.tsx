import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Navegacao } from '../App'
import type { EstadoApp } from '../estado'
import type { Casal, Despesa, Evento, Pessoa } from '../tipos'

/**
 * Teste de fumo: renderiza cada ecrã e confirma que aparece o que interessa.
 *
 * Não substitui abrir a app, mas apanha a classe de erro que o TypeScript não
 * vê — uma variável usada antes de existir, um hook mal chamado, um `.map` sobre
 * `undefined`. Sem isto, a primeira vez que se descobria era com a APK na mão.
 */

const PEDRO: Pessoa = { id: 'pedro', uid: 'uid-pedro', nome: 'Pedro' }
const LISA: Pessoa = { id: 'lisa', uid: 'uid-lisa', nome: 'Lisa' }

const casal: Casal = { id: 'casa', membros: [PEDRO.uid, LISA.uid], pessoas: [PEDRO, LISA] }

const agora = new Date()
const dia = 24 * 60 * 60 * 1000

const alentejo: Evento = {
  id: 'alentejo',
  nome: 'Alentejo',
  inicio: new Date(agora.getTime() - 2 * dia),
  fim: new Date(agora.getTime() + 2 * dia),
  percentagens: { pedro: 50, lisa: 50 },
  fechadoEm: null,
  acertadoCent: null,
}

function despesa(over: Partial<Despesa> = {}): Despesa {
  return {
    id: 'd1',
    eventoId: 'alentejo',
    pagouId: 'pedro',
    valorCent: 5000,
    descricao: 'Jantar',
    comerciante: null,
    soMinha: false,
    origem: 'manual',
    cartaoLast4: null,
    rawText: null,
    ocorreuEm: agora,
    estado: 'confirmada',
    ...over,
  }
}

const despesas = [
  despesa(),
  despesa({ id: 'd2', pagouId: 'lisa', valorCent: 7500 }),
  despesa({
    id: 'd3',
    estado: 'pendente',
    eventoId: null,
    comerciante: 'CAFE ORFEU',
    valorCent: 95,
    origem: 'mbway',
    rawText: 'Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.',
  }),
]

const nav: Navegacao = { ir: vi.fn(), voltar: vi.fn() }

let estado: EstadoApp

vi.mock('../estado', () => ({ useApp: () => estado }))
vi.mock('../dados/firestore', () => ({
  criarEvento: vi.fn(),
  criarDespesa: vi.fn(),
  atualizarDespesa: vi.fn(),
  apagarDespesa: vi.fn(),
  confirmarDespesa: vi.fn(),
  descartarDespesa: vi.fn(),
  fecharEvento: vi.fn(),
  reabrirEvento: vi.fn(),
}))
vi.mock('../dados/auth', () => ({ sair: vi.fn(), entrarComGoogle: vi.fn() }))
vi.mock('../dados/parserNativo', () => ({
  ParserNativo: {
    analisar: vi.fn(),
    pacotesConhecidos: vi.fn().mockResolvedValue({ pacotes: [] }),
    temAcessoNotificacoes: vi.fn().mockResolvedValue({ autorizado: true }),
    estadoCorpus: vi.fn().mockResolvedValue({ linhas: 0, bytes: 0 }),
    abrirDefinicoesNotificacoes: vi.fn(),
    abrirDefinicoesBateria: vi.fn(),
    partilharCorpus: vi.fn(),
    limparCorpus: vi.fn(),
  },
  parserDisponivel: () => false,
}))

async function comEstado(over: Partial<EstadoApp> = {}) {
  const { calcularSaldoGlobal } = await import('../dominio/saldo')
  const eventos = over.eventos ?? [alentejo]
  const todas = over.despesas ?? despesas

  estado = {
    utilizador: { uid: PEDRO.uid, email: 'pedro@exemplo.pt', nome: 'Pedro' },
    casalId: 'casa',
    casal,
    eu: PEDRO,
    outra: LISA,
    eventos,
    despesas: todas,
    heartbeats: [],
    saldo: calcularSaldoGlobal(todas, eventos, PEDRO.id, LISA.id),
    alertas: [],
    porTratar: todas.filter((d) => d.estado === 'pendente'),
    carregando: false,
    erro: null,
    avisos: [],
    ...over,
  }
}

afterEach(cleanup)

describe('Início', () => {
  it('mostra quem deve a quem e a caixa por tratar', async () => {
    await comEstado()
    const Inicio = (await import('./Inicio')).default
    render(<Inicio nav={nav} />)

    // Pedro 50, Lisa 75, a meias → Pedro deve 12,50.
    expect(screen.getByText('12,50 €')).toBeDefined()
    expect(screen.getByText(/Deves a/)).toBeDefined()
    expect(screen.getByText(/1 despesa por tratar/)).toBeDefined()
    expect(screen.getByText('Alentejo')).toBeDefined()
  })

  it('diz que estão quites quando estão', async () => {
    await comEstado({ despesas: [despesa(), despesa({ id: 'd2', pagouId: 'lisa' })] })
    const Inicio = (await import('./Inicio')).default
    render(<Inicio nav={nav} />)

    expect(screen.getByText('Estão quites')).toBeDefined()
  })

  it('sem eventos, explica que a captura está desligada', async () => {
    await comEstado({ eventos: [], despesas: [] })
    const Inicio = (await import('./Inicio')).default
    render(<Inicio nav={nav} />)

    expect(screen.getByText(/capturas automáticas ficam desligadas/)).toBeDefined()
  })
})

describe('Evento', () => {
  it('mostra o saldo, o detalhe de cada pessoa e as despesas', async () => {
    await comEstado()
    const EcraEvento = (await import('./Evento')).default
    render(<EcraEvento eventoId="alentejo" nav={nav} />)

    expect(screen.getByText(/Pedro deve a Lisa/)).toBeDefined()
    expect(screen.getAllByText('Jantar').length).toBe(2)
    expect(screen.getByText(/2 despesas/)).toBeDefined()
  })

  it('não rebenta com um evento que não existe', async () => {
    await comEstado()
    const EcraEvento = (await import('./Evento')).default
    render(<EcraEvento eventoId="nao-existe" nav={nav} />)

    expect(screen.getByText(/não encontrado/)).toBeDefined()
  })
})

describe('Por tratar', () => {
  it('mostra a captura com o comerciante e o botão do evento sugerido', async () => {
    await comEstado()
    const PorTratar = (await import('./PorTratar')).default
    render(<PorTratar nav={nav} />)

    expect(screen.getByText('CAFE ORFEU')).toBeDefined()
    expect(screen.getByText('0,95 €')).toBeDefined()
    expect(screen.getByText('Alentejo')).toBeDefined()
    expect(screen.getByText('Não é da viagem')).toBeDefined()
  })

  it('quando não há nada por tratar, diz isso', async () => {
    await comEstado({ despesas: [despesa()] })
    const PorTratar = (await import('./PorTratar')).default
    render(<PorTratar nav={nav} />)

    expect(screen.getByText(/Nada por tratar/)).toBeDefined()
  })
})

describe('Dashboard', () => {
  it('mostra o total do ano e o custo por dia', async () => {
    await comEstado()
    const Dashboard = (await import('./Dashboard')).default
    render(<Dashboard nav={nav} />)

    expect(screen.getByText('Total do ano')).toBeDefined()
    // Duas vezes: o total do ano e a barra do único evento que o compõe.
    expect(screen.getAllByText('125,00 €')).toHaveLength(2)
    // 125 € em 5 dias de calendário.
    expect(screen.getByText(/25,00 € por dia/)).toBeDefined()
  })
})

describe('formulários', () => {
  it('novo evento arranca com os dois nomes e 50/50', async () => {
    await comEstado()
    const NovoEvento = (await import('./NovoEvento')).default
    render(<NovoEvento nav={nav} />)

    expect(screen.getByText(/Pedro 50% \/ Lisa 50%/)).toBeDefined()
  })

  it('nova despesa oferece os dois pagadores e os eventos abertos', async () => {
    await comEstado()
    const NovaDespesa = (await import('./NovaDespesa')).default
    render(<NovaDespesa eventoId="alentejo" nav={nav} />)

    expect(screen.getByText('Pedro')).toBeDefined()
    expect(screen.getByText('Lisa')).toBeDefined()
    expect(screen.getByText(/Alentejo/)).toBeDefined()
  })
})

describe('Eventos e Configuração', () => {
  it('a lista marca o evento a decorrer', async () => {
    await comEstado()
    const Eventos = (await import('./Eventos')).default
    render(<Eventos nav={nav} />)

    expect(screen.getByText('a decorrer')).toBeDefined()
  })

  it('a configuração lista os três passos da instalação', async () => {
    await comEstado()
    const Configuracao = (await import('./Configuracao')).default
    render(<Configuracao nav={nav} />)

    expect(screen.getByText(/1. Acesso a notificações/)).toBeDefined()
    expect(screen.getByText(/2. Otimização de bateria/)).toBeDefined()
    expect(screen.getByText(/3. Quem és tu/)).toBeDefined()
  })
})
