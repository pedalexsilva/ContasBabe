// @vitest-environment node

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseCent as parseCentTS, formatarCent as formatarCentTS } from './dominio/dinheiro'

/**
 * A versão leve (Tasker + Google Sheets) tem a sua própria cópia das regras de
 * dinheiro e de deduplicação, porque o Apps Script não pode importar nada deste
 * repositório. São três implementações da mesma coisa — TypeScript, Kotlin e
 * agora Apps Script — e três cópias só se justificam se falharem juntas.
 *
 * Este ficheiro carrega o `.gs` a sério e corre-o contra os mesmos casos.
 */

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)))
const codigo = readFileSync(join(RAIZ, 'docs/tasker/Codigo.gs'), 'utf8')

interface Notificacao {
  pacote: string
  titulo: string
  texto: string
}

interface Captura {
  valorCent: number
  comerciante: string | null
  cartaoLast4: string | null
  origem: string
}

interface Candidata {
  linha: number
  valorCent: number
  pagouId: string
  ocorreuEmMs: number
  origem: string
  cartaoLast4: string | null
}

interface Evento {
  nome: string
  inicioMs: number
  fimMs: number
  percPrimeira: number
  fechado: boolean
}

interface Gs {
  parseCent: (t: unknown) => number | null
  formatarCent: (c: number) => string
  analisar: (n: Notificacao) => Captura | null
  decidir: (
    nova: { valorCent: number; origem: string; cartaoLast4: string | null },
    pagouId: string,
    ocorreuEmMs: number,
    candidatas: Candidata[],
  ) => { acao: string; linha?: number; last4?: string | null }
  estaAtivo: (e: Evento, agoraMs: number) => boolean
  eventosAtivos: (eventos: Evento[], agoraMs: number) => Evento[]
  JANELA_MS: number
  TOLERANCIA_POS_FIM_MS: number
}

// As APIs do Google só são tocadas dentro do `doPost`, por isso avaliar o
// ficheiro define tudo sem precisar delas.
const carregar = new Function(
  `${codigo}\nreturn { parseCent, formatarCent, analisar, decidir, estaAtivo, eventosAtivos, JANELA_MS, TOLERANCIA_POS_FIM_MS };`,
)
const gs = carregar() as Gs

const SANTANDER = 'pt.santandertotta.mobileapp'
const MBWAY = 'pt.sibs.android.mbway'
const WALLET = 'com.google.android.apps.walletnfcrel'

describe('parseCent — igual ao gémeo TypeScript', () => {
  const casos: [string, number | null][] = [
    ['0,95', 95],
    ['0.95', 95],
    ['EUR 0,95', 95],
    ['0.95€', 95],
    ['3,20 eur', 320],
    ['1,00 euro', 100],
    ['3,20 euros', 320],
    ['1.234,56', 123456],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['1,50', 150],
    ['1.234.567,89', 123456789],
    ['-12,50', -1250],
    ['−12,50', -1250],
    ['+12,50', 1250],
    ['12', 1200],
    ['12€', 1200],
    ['0,5', 50],
    ['', null],
    ['EUR', null],
    ['   ', null],
    ['1,2345', null],
    ['1.23,45', null],
    ['12.3456,78', null],
    ['1,', null],
    [',95', null],
    ['1,,95', null],
    ['12 meses', null],
    ['50%', null],
  ]

  for (const [entrada, esperado] of casos) {
    it(`${JSON.stringify(entrada)} → ${esperado}`, () => {
      expect(gs.parseCent(entrada)).toBe(esperado)
      // E, o que interessa mesmo: o mesmo que a implementação de referência.
      expect(gs.parseCent(entrada)).toBe(parseCentTS(entrada))
    })
  }

  it('sobrevive aos espaços invisíveis das apps de bancos', () => {
    expect(gs.parseCent('0,95 €')).toBe(95)
    expect(gs.parseCent('1 234,56 €')).toBe(123456)
    expect(gs.parseCent('1 234,56')).toBe(123456)
  })
})

describe('formatarCent — igual ao gémeo TypeScript', () => {
  it('formata com ponto nos milhares e vírgula decimal', () => {
    for (const cent of [0, 5, 95, 1250, 123456, 123456789, -1250]) {
      expect(gs.formatarCent(cent)).toBe(formatarCentTS(cent))
    }
    expect(gs.formatarCent(123456)).toBe('1.234,56 €')
  })
})

describe('parser do Santander', () => {
  it('extrai valor e últimos quatro dígitos do texto real', () => {
    expect(
      gs.analisar({
        pacote: SANTANDER,
        titulo: 'Santander',
        texto: 'Movimento no valor de EUR 0,95 no cartão ***********0390',
      }),
    ).toEqual({ valorCent: 95, comerciante: null, cartaoLast4: '0390', origem: 'santander' })
  })

  it('descarta pedidos de 3D Secure, mesmo com acentos', () => {
    expect(
      gs.analisar({
        pacote: SANTANDER,
        titulo: 'Santander',
        texto: 'Autorização de compra no valor de EUR 24,99 no cartão ***********0390',
      }),
    ).toBeNull()
  })

  it('não morde num número solto numa promoção', () => {
    expect(
      gs.analisar({ pacote: SANTANDER, titulo: 'Santander', texto: 'Ganhe 50 € em compras!' }),
    ).toBeNull()
  })
})

describe('parser do MB Way', () => {
  it('extrai comerciante e valor do texto real', () => {
    expect(
      gs.analisar({
        pacote: MBWAY,
        titulo: 'Compra QRCode',
        texto: 'Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.',
      }),
    ).toEqual({ valorCent: 95, comerciante: 'CAFE ORFEU', cartaoLast4: null, origem: 'mbway' })
  })

  it('não corta o comerciante na primeira vírgula', () => {
    const r = gs.analisar({
      pacote: MBWAY,
      titulo: 'Compra QRCode',
      texto: 'Compra QR Code no comerciante CAFE ORFEU, LDA, no valor de 12,50€, efetuada.',
    })
    expect(r?.comerciante).toBe('CAFE ORFEU, LDA')
    expect(r?.valorCent).toBe(1250)
  })

  it('deixa passar as transferências para a Fase 3', () => {
    expect(
      gs.analisar({
        pacote: MBWAY,
        titulo: 'Transferência',
        texto: 'Transferência de 20,00€ no comerciante X, no valor de 20,00€, efetuada.',
      }),
    ).toBeNull()
  })
})

describe('parser da Wallet', () => {
  it('continua a ser um stub — não há texto real para o escrever', () => {
    // Este teste é para SUBSTITUIR quando o corpus chegar, não para apagar.
    expect(
      gs.analisar({ pacote: WALLET, titulo: 'Google Wallet', texto: 'Qualquer coisa 4,20 €' }),
    ).toBeNull()
  })
})

describe('deduplicação', () => {
  const AGORA = 1_800_000_000_000

  function candidata(over: Partial<Candidata> = {}): Candidata {
    return {
      linha: 7,
      valorCent: 95,
      pagouId: 'pedro',
      ocorreuEmMs: AGORA,
      origem: 'mbway',
      cartaoLast4: null,
      ...over,
    }
  }

  const santander = { valorCent: 95, origem: 'santander', cartaoLast4: '0390' }
  const mbway = { valorCent: 95, origem: 'mbway', cartaoLast4: null }

  it('sem par, cria', () => {
    expect(gs.decidir(santander, 'pedro', AGORA, []).acao).toBe('criar')
  })

  it('Santander com par primário descarta e aproveita o last4', () => {
    expect(gs.decidir(santander, 'pedro', AGORA + 45_000, [candidata()])).toEqual({
      acao: 'descartar',
      linha: 7,
      last4: '0390',
    })
  })

  it('Santander com par manual descarta — acabaste de o escrever à mão', () => {
    expect(
      gs.decidir(santander, 'pedro', AGORA + 40_000, [candidata({ origem: 'manual' })]).acao,
    ).toBe('descartar')
  })

  it('primária com par do Santander enriquece', () => {
    expect(
      gs.decidir(mbway, 'pedro', AGORA + 45_000, [candidata({ origem: 'santander' })]),
    ).toEqual({ acao: 'enriquecer', linha: 7 })
  })

  it('duas primárias criam as duas — são dois cafés, não um duplicado', () => {
    expect(gs.decidir(mbway, 'pedro', AGORA + 60_000, [candidata()]).acao).toBe('criar')
  })

  it('fora da janela de três minutos, cria', () => {
    expect(gs.decidir(santander, 'pedro', AGORA + gs.JANELA_MS + 1, [candidata()]).acao).toBe(
      'criar',
    )
  })

  it('valor ou pagador diferentes não são par', () => {
    expect(gs.decidir(santander, 'pedro', AGORA, [candidata({ valorCent: 96 })]).acao).toBe('criar')
    expect(gs.decidir(santander, 'lisa', AGORA, [candidata()]).acao).toBe('criar')
  })

  it('escolhe o par mais próximo no tempo', () => {
    const decisao = gs.decidir(santander, 'pedro', AGORA, [
      candidata({ linha: 5, ocorreuEmMs: AGORA - 120_000 }),
      candidata({ linha: 9, ocorreuEmMs: AGORA - 10_000 }),
    ])
    expect(decisao.linha).toBe(9)
  })
})

describe('janela dos eventos', () => {
  const DIA = 24 * 60 * 60 * 1000

  function evento(over: Partial<Evento> = {}): Evento {
    return {
      nome: 'Alentejo',
      // Uma célula de data do Sheets vale meia-noite do dia escrito.
      inicioMs: new Date('2026-05-08T00:00:00Z').getTime(),
      fimMs: new Date('2026-05-12T00:00:00Z').getTime(),
      percPrimeira: 50,
      fechado: false,
      ...over,
    }
  }

  const meioDoEvento = new Date('2026-05-10T12:00:00Z').getTime()
  const fimDoUltimoDia = new Date('2026-05-12T23:30:00Z').getTime()

  it('está ativo a meio do período', () => {
    expect(gs.estaAtivo(evento(), meioDoEvento)).toBe(true)
  })

  it('inclui o dia do fim inteiro, não só a meia-noite', () => {
    // Quem escreve "8 a 12 de maio" quer o dia 12 contado. Sem isto, as
    // despesas do último dia da viagem caíam todas fora.
    expect(gs.estaAtivo(evento(), fimDoUltimoDia)).toBe(true)
  })

  it('continua ativo nos três dias a seguir, para os reembolsos', () => {
    expect(gs.estaAtivo(evento(), fimDoUltimoDia + 2 * DIA)).toBe(true)
  })

  it('deixa de estar ativo passada a tolerância', () => {
    expect(gs.estaAtivo(evento(), fimDoUltimoDia + 4 * DIA)).toBe(false)
  })

  it('não está ativo antes de começar', () => {
    expect(gs.estaAtivo(evento(), new Date('2026-05-07T12:00:00Z').getTime())).toBe(false)
  })

  it('um evento fechado nunca está ativo, mesmo a meio das datas', () => {
    expect(gs.estaAtivo(evento({ fechado: true }), meioDoEvento)).toBe(false)
  })

  it('devolve só os que estão a decorrer', () => {
    const ativos = gs.eventosAtivos(
      [
        evento(),
        evento({ nome: 'Lisboa' }),
        evento({
          nome: 'Antigo',
          inicioMs: new Date('2025-01-01T00:00:00Z').getTime(),
          fimMs: new Date('2025-01-05T00:00:00Z').getTime(),
        }),
      ],
      meioDoEvento,
    )
    expect(ativos.map((e) => e.nome)).toEqual(['Alentejo', 'Lisboa'])
  })

  it('sem eventos nenhuns, nada está ativo', () => {
    expect(gs.eventosAtivos([], meioDoEvento)).toEqual([])
  })

  it('a tolerância é a mesma do plano e do núcleo Kotlin', () => {
    expect(gs.TOLERANCIA_POS_FIM_MS).toBe(3 * DIA)
  })
})
