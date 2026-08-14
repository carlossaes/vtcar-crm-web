import { useEffect, useMemo, useState } from 'react'
import { Download, DownloadCloud, Loader2, MessagesSquare, RefreshCw, SearchX, TriangleAlert } from 'lucide-react'
import EmptyState from '../components/EmptyState'
import { getGptmakerChats, getLeads, importarAntigos } from '../api'
import { displayName, formatPhone, hasName } from '../format'

// Tipo de canal do GPT Maker -> rotulo que a equipe entende.
const CANAIS = {
  WHATSAPP: 'WhatsApp',
  Z_API: 'WhatsApp',
  CLOUD_API: 'WhatsApp',
  INSTAGRAM: 'Instagram',
  MESSENGER: 'Facebook',
  WIDGET: 'Site',
  TELEGRAM: 'Telegram',
  MERCADO_LIVRE: 'Mercado Livre',
}

const FILTROS = [
  { id: 'todos', label: 'Todos' },
  { id: 'sim', label: 'Já no CRM' },
  { id: 'nao', label: 'Fora do CRM' },
]

const COLUNAS = [
  { id: 'nome', label: 'Nome' },
  { id: 'telefone', label: 'Celular' },
  { id: 'data', label: 'Primeiro contato' },
  { id: 'canal', label: 'Canal' },
  { id: 'noCrm', label: 'No CRM' },
]

const fmtDataHora = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
})
const fmtData = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })

const soDigitos = (v) => String(v || '').replace(/\D/g, '')

export default function Contatos({ search, usuario }) {
  const [linhas, setLinhas] = useState([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState(null)
  const [ordem, setOrdem] = useState({ col: 'data', dir: 'desc' })
  const [filtro, setFiltro] = useState('todos')
  const [importando, setImportando] = useState(false)
  const [resultadoImport, setResultadoImport] = useState(null)

  const carregar = async () => {
    setCarregando(true)
    setErro(null)
    try {
      // O GPT Maker e a fonte da verdade: la esta todo mundo que ja falou com
      // o WhatsApp. Os leads entram so pra marcar quem virou registro no CRM.
      const [gpt, leads] = await Promise.all([getGptmakerChats(), getLeads().catch(() => [])])
      const fonesNoCrm = new Set((leads || []).map((l) => soDigitos(l.phone)).filter(Boolean))
      // Casar so por telefone nao basta: contato que chega no formato "@lid"
      // do WhatsApp entra no CRM com o identificador no lugar do numero, e o
      // telefone nunca bate. O id do chat resolve esses casos.
      const chatIdsNoCrm = new Set((leads || []).map((l) => l.gptmakerChatId).filter(Boolean))

      setLinhas(
        (gpt.chats || []).map((c) => {
          const cru = soDigitos(c.phone)
          return {
            id: c.id,
            nome: displayName({ name: c.name, phone: null }),
            temNome: hasName({ name: c.name }),
            telefone: formatPhone(c.phone) || '—',
            telefoneCru: cru,
            data: c.createdAt ? new Date(c.createdAt) : null,
            canal: CANAIS[c.channelType] || c.channelType || '—',
            noCrm: (cru && fonesNoCrm.has(cru)) || (c.id && chatIdsNoCrm.has(c.id)),
          }
        })
      )
    } catch (err) {
      setErro(err.message)
      setLinhas([])
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => {
    carregar()
  }, [])

  const filtradas = useMemo(() => {
    let base = linhas
    if (filtro !== 'todos') base = base.filter((l) => (filtro === 'sim' ? l.noCrm : !l.noCrm))

    const q = (search || '').trim().toLowerCase()
    if (q) {
      const digitos = q.replace(/\D/g, '')
      base = base.filter(
        (l) =>
          l.nome.toLowerCase().includes(q) ||
          l.telefone.toLowerCase().includes(q) ||
          (digitos && l.telefoneCru.includes(digitos)) ||
          l.canal.toLowerCase().includes(q) ||
          (l.data && fmtDataHora.format(l.data).includes(q))
      )
    }

    const valor = (l) => {
      if (ordem.col === 'data') return l.data ? l.data.getTime() : 0
      if (ordem.col === 'telefone') return l.telefoneCru
      if (ordem.col === 'noCrm') return l.noCrm ? 1 : 0
      // sem nome vai pro fim quando ordena por nome
      if (ordem.col === 'nome') return (l.temNome ? l.nome : 'zzzz').toLowerCase()
      return String(l[ordem.col] || '').toLowerCase()
    }

    return [...base].sort((a, b) => {
      const va = valor(a)
      const vb = valor(b)
      const r = va < vb ? -1 : va > vb ? 1 : 0
      return ordem.dir === 'asc' ? r : -r
    })
  }, [linhas, filtro, search, ordem])

  // Importar e seguro repetir: quem ja esta no CRM e ignorado. Mesmo assim
  // rodamos o ensaio antes e mostramos o numero exato pra confirmacao.
  const importar = async () => {
    setImportando(true)
    setErro(null)
    setResultadoImport(null)
    try {
      const ensaio = await importarAntigos(true)
      if (ensaio.importados === 0) {
        setResultadoImport('Nada a importar — todos os contatos já estão no CRM.')
        return
      }
      const de = ensaio.periodoImportado?.do ? fmtData.format(new Date(ensaio.periodoImportado.do)) : '—'
      const ate = ensaio.periodoImportado?.ate ? fmtData.format(new Date(ensaio.periodoImportado.ate)) : '—'
      const semTelefone = ensaio.ignorados?.length
        ? `\n\n${ensaio.ignorados.length} contato(s) ficam de fora por não ter telefone.`
        : ''
      const confirma = window.confirm(
        `Importar ${ensaio.importados} contatos para o CRM?\n\nSão conversas de ${de} a ${ate}. ` +
        `Todos entram como "Novo", com a data original preservada.${semTelefone}`
      )
      if (!confirma) return

      const r = await importarAntigos(false)
      setResultadoImport(`${r.importados} contatos importados. O CRM agora tem ${r.totalNoCrmDepois} leads.`)
      carregar()
    } catch (err) {
      setErro(err.message)
    } finally {
      setImportando(false)
    }
  }

  const ordenarPor = (col) => {
    setOrdem((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'data' ? 'desc' : 'asc' }))
  }

  const baixarCsv = () => {
    const cab = ['Nome', 'Celular', 'Primeiro contato', 'Canal', 'No CRM']
    const corpo = filtradas.map((l) => [
      l.temNome ? l.nome : 'sem nome no perfil',
      l.telefone,
      l.data ? fmtDataHora.format(l.data) : '',
      l.canal,
      l.noCrm ? 'Sim' : 'Não',
    ])
    // BOM + ponto-e-virgula: e o que o Excel em portugues abre certo.
    const csv = '﻿' + [cab, ...corpo].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n')
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    a.download = 'contatos-vtcar.csv'
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const fora = linhas.filter((l) => !l.noCrm).length
  const datas = linhas.map((l) => l.data).filter(Boolean).sort((a, b) => a - b)
  const primeiroNoCrm = linhas.filter((l) => l.noCrm && l.data).map((l) => l.data).sort((a, b) => a - b)[0]

  return (
    <div className="space-y-4">
      {!carregando && !erro && linhas.length > 0 && (
        <div className="bg-surface border border-line rounded-card shadow-card px-5 py-3.5 text-[12.5px] text-ink2 leading-relaxed">
          <b className="text-ink">Todo mundo que já falou com o WhatsApp da VT Car</b>, direto do GPT Maker
          {datas.length > 0 && <> — desde {fmtData.format(datas[0])}</>}.{' '}
          {fora > 0 ? (
            <>
              <b className="text-ink">{fora}</b> destes contatos não estão no CRM: são anteriores a{' '}
              {primeiroNoCrm ? fmtData.format(primeiroNoCrm) : '—'}, quando a integração passou a gravar
              automaticamente. Use o filtro “Fora do CRM” para vê-los.
              {usuario?.papel === 'gerente' && (
                <button
                  onClick={importar}
                  disabled={importando}
                  className="ml-2 inline-flex items-center gap-1.5 border border-line rounded-control px-2.5 h-7 text-[12px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors disabled:opacity-50 align-middle"
                >
                  {importando ? <Loader2 size={12} className="animate-spin" /> : <DownloadCloud size={12} />}
                  Trazer para o CRM
                </button>
              )}
            </>
          ) : (
            'Todos já estão no CRM.'
          )}
          {resultadoImport && <div className="mt-2 text-ink font-medium">{resultadoImport}</div>}
        </div>
      )}

      <section className="bg-surface border border-line rounded-card shadow-card overflow-hidden">
        <header className="flex flex-wrap items-center gap-3 px-5 py-4 border-b border-line">
          <h2 className="text-[13.5px] font-semibold mr-auto">
            Contatos{' '}
            <span className="text-ink3 font-normal tnum">{carregando ? '' : `(${filtradas.length})`}</span>
          </h2>

          <div className="flex items-center gap-1 bg-surface2 border border-line rounded-control p-0.5">
            {FILTROS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFiltro(f.id)}
                className={`px-2.5 py-1 rounded-[7px] text-[12px] font-medium transition-colors ${
                  filtro === f.id ? 'bg-surface text-ink shadow-card' : 'text-ink2 hover:text-ink'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <button
            onClick={baixarCsv}
            disabled={!filtradas.length}
            className="flex items-center gap-1.5 border border-line rounded-control px-3 h-8 text-[12.5px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors disabled:opacity-40"
          >
            <Download size={13} />
            CSV
          </button>
          <button
            onClick={carregar}
            disabled={carregando}
            className="flex items-center gap-1.5 border border-line rounded-control px-3 h-8 text-[12.5px] font-medium text-ink2 hover:text-ink hover:border-lineStrong transition-colors disabled:opacity-40"
          >
            <RefreshCw size={13} className={carregando ? 'animate-spin' : ''} />
            Atualizar
          </button>
        </header>

        {erro ? (
          <EmptyState
            icon={TriangleAlert}
            title="Não consegui carregar os contatos"
            description={`${erro}. O servidor pode estar iniciando — tente "Atualizar" em alguns segundos.`}
          />
        ) : carregando ? (
          <div className="py-16 text-center text-[13px] text-ink2">Carregando os contatos…</div>
        ) : filtradas.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-micro uppercase font-semibold text-ink3 bg-surface2/60">
                  {COLUNAS.map((c, i) => {
                    const ativo = ordem.col === c.id
                    return (
                      <th
                        key={c.id}
                        onClick={() => ordenarPor(c.id)}
                        aria-sort={ativo ? (ordem.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                        className={`py-2.5 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-ink2 transition-colors ${
                          i === 0 ? 'px-5' : 'px-3'
                        }`}
                      >
                        {c.label}
                        <span className={`ml-1 ${ativo ? 'text-brand' : 'opacity-40'}`}>
                          {ativo ? (ordem.dir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((l) => (
                  <tr key={l.id} className="border-t border-line hover:bg-surface2 transition-colors">
                    <td className="py-3 px-5">
                      {l.temNome ? (
                        <span className="text-[13.5px] font-medium">{l.nome}</span>
                      ) : (
                        <span className="text-[13.5px] text-ink3" title="Esse contato não tem nome no perfil do WhatsApp">
                          sem nome no perfil
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-[13px] text-ink2 tnum">{l.telefone}</td>
                    <td className="py-3 px-3 text-[13px] text-ink2 tnum">
                      {l.data ? fmtDataHora.format(l.data) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center rounded-full border border-line bg-surface2 px-2.5 py-[3px] text-[11.5px] font-medium text-ink2">
                        {l.canal}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[11.5px] font-medium ${
                          l.noCrm
                            ? 'border-line bg-surface2 text-ink2'
                            : 'border-brand/35 bg-brand/[0.07] text-brand'
                        }`}
                      >
                        <span
                          className={`w-[7px] h-[7px] rounded-full ${l.noCrm ? 'bg-stage3' : 'bg-brand'}`}
                          aria-hidden="true"
                        />
                        {l.noCrm ? 'Sim' : 'Não'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : linhas.length === 0 ? (
          <EmptyState
            icon={MessagesSquare}
            title="Nenhum contato no GPT Maker"
            description="Assim que alguém mandar a primeira mensagem para a Vitória, o contato aparece aqui."
          />
        ) : (
          <EmptyState
            icon={SearchX}
            title="Nada bateu com esse filtro"
            description="Tente outro filtro ou limpe a busca lá em cima."
          />
        )}
      </section>
    </div>
  )
}
