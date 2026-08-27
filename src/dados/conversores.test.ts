import { Timestamp } from '@capacitor-firebase/firestore'
import { describe, expect, it } from 'vitest'
import {
  casalDeDoc,
  despesaDeDoc,
  despesaParaDoc,
  eventoDeDoc,
  eventoParaDoc,
  mapearDocumentos,
  paraData,
} from './conversores'

const QUANDO = new Date('2026-05-10T12:00:00.000Z')

const despesaDoc = {
  eventoId: 'alentejo',
  pagouId: 'pedro',
  valorCent: 95,
  descricao: null,
  comerciante: 'CAFE ORFEU',
  soMinha: false,
  origem: 'mbway',
  cartaoLast4: null,
  rawText: 'Compra QR Code no comerciante CAFE ORFEU, no valor de 0.95€, efetuada.',
  ocorreuEm: Timestamp.fromDate(QUANDO),
  estado: 'confirmada',
}

describe('paraData — o que atravessa a ponte nativa', () => {
  it('aceita uma instância de Timestamp', () => {
    expect(paraData(Timestamp.fromDate(QUANDO))?.toISOString()).toBe(QUANDO.toISOString())
  })

  it('aceita o Timestamp já serializado em {seconds, nanoseconds}', () => {
    expect(paraData({ seconds: 1778414400, nanoseconds: 0 })?.toISOString()).toBe(
      '2026-05-10T12:00:00.000Z',
    )
  })

  it('aceita millis e ISO, que é o que o lado Kotlin pode mandar', () => {
    expect(paraData(QUANDO.getTime())?.toISOString()).toBe(QUANDO.toISOString())
    expect(paraData(QUANDO.toISOString())?.toISOString()).toBe(QUANDO.toISOString())
  })

  it('devolve null para o que não é data, em vez de uma data inventada', () => {
    expect(paraData(null)).toBeNull()
    expect(paraData(undefined)).toBeNull()
    expect(paraData('nem por isso')).toBeNull()
    expect(paraData({})).toBeNull()
  })
})

describe('despesa — ida e volta', () => {
  it('converte um documento válido', () => {
    const d = despesaDeDoc('abc', { ...despesaDoc })
    expect(d.id).toBe('abc')
    expect(d.valorCent).toBe(95)
    expect(d.comerciante).toBe('CAFE ORFEU')
    expect(d.ocorreuEm.toISOString()).toBe(QUANDO.toISOString())
    expect(d.estado).toBe('confirmada')
  })

  it('grava a data como Timestamp, nunca como string', () => {
    const doc = despesaParaDoc(despesaDeDoc('abc', { ...despesaDoc }))
    expect(doc.ocorreuEm).toBeInstanceOf(Timestamp)
  })

  it('sobrevive à ida e volta sem perder nada', () => {
    const original = despesaDeDoc('abc', { ...despesaDoc })
    const volta = despesaDeDoc('abc', despesaParaDoc(original) as Record<string, unknown>)
    expect(volta).toEqual(original)
  })

  it('trata campos opcionais vazios como null', () => {
    const d = despesaDeDoc('abc', { ...despesaDoc, comerciante: '', descricao: undefined })
    expect(d.comerciante).toBeNull()
    expect(d.descricao).toBeNull()
  })

  it('aceita uma pendente sem evento', () => {
    const d = despesaDeDoc('abc', { ...despesaDoc, estado: 'pendente', eventoId: null })
    expect(d.eventoId).toBeNull()
    expect(d.estado).toBe('pendente')
  })
})

describe('despesa — recusa dados corrompidos em vez de os assumir', () => {
  it('recusa um valor em euros disfarçado de cêntimos', () => {
    // 0,95 gravado como float significa que alguém gravou euros. Arredondar
    // por conta própria escondia o erro dentro de um saldo com bom aspeto.
    expect(() => despesaDeDoc('abc', { ...despesaDoc, valorCent: 0.95 })).toThrow(/valorCent/)
  })

  it('recusa valor em falta ou não numérico', () => {
    expect(() => despesaDeDoc('abc', { ...despesaDoc, valorCent: undefined })).toThrow(/valorCent/)
    expect(() => despesaDeDoc('abc', { ...despesaDoc, valorCent: '95' })).toThrow(/valorCent/)
  })

  it('recusa estado ou origem desconhecidos', () => {
    expect(() => despesaDeDoc('abc', { ...despesaDoc, estado: 'tratada' })).toThrow(/estado/)
    expect(() => despesaDeDoc('abc', { ...despesaDoc, origem: 'revolut' })).toThrow(/origem/)
  })

  it('recusa uma data em falta', () => {
    expect(() => despesaDeDoc('abc', { ...despesaDoc, ocorreuEm: null })).toThrow(/ocorreuEm/)
  })

  it('recusa uma confirmada sem evento — entraria em lado nenhum', () => {
    expect(() => despesaDeDoc('abc', { ...despesaDoc, eventoId: null })).toThrow(/eventoId/)
  })

  it('recusa um pagador em falta', () => {
    expect(() => despesaDeDoc('abc', { ...despesaDoc, pagouId: '' })).toThrow(/pagouId/)
  })
})

describe('evento', () => {
  const eventoDoc = {
    nome: 'Alentejo',
    inicio: Timestamp.fromDate(new Date('2026-05-08T00:00:00Z')),
    fim: Timestamp.fromDate(new Date('2026-05-12T00:00:00Z')),
    percentagens: { pedro: 50, lisa: 50 },
    fechadoEm: null,
    acertadoCent: null,
  }

  it('converte e volta sem perder nada', () => {
    const e = eventoDeDoc('alentejo', { ...eventoDoc })
    expect(e.nome).toBe('Alentejo')
    expect(e.percentagens).toEqual({ pedro: 50, lisa: 50 })
    expect(e.fechadoEm).toBeNull()

    const volta = eventoDeDoc('alentejo', eventoParaDoc(e) as Record<string, unknown>)
    expect(volta).toEqual(e)
  })

  it('lê um evento já fechado e acertado', () => {
    const e = eventoDeDoc('alentejo', {
      ...eventoDoc,
      fechadoEm: Timestamp.fromDate(QUANDO),
      acertadoCent: 1250,
    })
    expect(e.fechadoEm?.toISOString()).toBe(QUANDO.toISOString())
    expect(e.acertadoCent).toBe(1250)
  })

  it('recusa percentagens fora de 0–100 ou não numéricas', () => {
    expect(() => eventoDeDoc('x', { ...eventoDoc, percentagens: { pedro: 150, lisa: -50 } })).toThrow(
      /percentagens.pedro/,
    )
    expect(() => eventoDeDoc('x', { ...eventoDoc, percentagens: { pedro: '50' } })).toThrow(
      /percentagens.pedro/,
    )
  })

  it('recusa percentagens em falta', () => {
    expect(() => eventoDeDoc('x', { ...eventoDoc, percentagens: undefined })).toThrow(/percentagens/)
  })

  it('recusa um valor de acerto em euros', () => {
    expect(() => eventoDeDoc('x', { ...eventoDoc, acertadoCent: 12.5 })).toThrow(/acertadoCent/)
  })
})

describe('casal', () => {
  const casalDoc = {
    membros: ['uid-pedro', 'uid-lisa'],
    pessoas: [
      { id: 'pedro', uid: 'uid-pedro', nome: 'Pedro' },
      { id: 'lisa', uid: 'uid-lisa', nome: 'Lisa' },
    ],
  }

  it('lê os membros e as pessoas', () => {
    const c = casalDeDoc('casa', { ...casalDoc })
    expect(c.membros).toEqual(['uid-pedro', 'uid-lisa'])
    expect(c.pessoas[0]?.nome).toBe('Pedro')
  })

  it('recusa um casal que não tenha exatamente duas pessoas', () => {
    expect(() => casalDeDoc('casa', { ...casalDoc, pessoas: [casalDoc.pessoas[0]] })).toThrow(/2 pessoas/)
  })

  it('recusa uma pessoa sem UID — sem ele as regras nunca a deixariam escrever', () => {
    expect(() =>
      casalDeDoc('casa', {
        ...casalDoc,
        pessoas: [{ id: 'pedro', nome: 'Pedro' }, casalDoc.pessoas[1]],
      }),
    ).toThrow(/uid/)
  })
})

describe('mapearDocumentos', () => {
  it('separa o que converteu do que falhou, em vez de rebentar tudo', () => {
    const r = mapearDocumentos(
      [
        { id: 'boa', data: { ...despesaDoc } },
        { id: 'ma', data: { ...despesaDoc, valorCent: 'muito' } },
        { id: 'vazia', data: null },
      ],
      despesaDeDoc,
    )

    expect(r.itens).toHaveLength(1)
    expect(r.itens[0]?.id).toBe('boa')
    expect(r.falhas.map((f) => f.id)).toEqual(['ma', 'vazia'])
    expect(r.falhas[0]?.erro).toMatch(/valorCent/)
  })
})
