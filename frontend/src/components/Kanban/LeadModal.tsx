import { useQuery } from '@tanstack/react-query'
import { kanbanApi } from '../../api/kanban'
import { KanbanCard } from '../../types'
import { X, Brain, BarChart3, ChevronDown, ChevronUp, Zap, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import clsx from 'clsx'
import {
  semanticColors,
  normalizeTemperatura,
  normalizeSentimento,
} from '../../lib/semanticColors'
import LeadAvatar from '../ui/LeadAvatar'
import ChannelIcon from '../ui/ChannelIcon'
import OpenActions from '../ui/OpenActions'
import { Pill, EmptyState } from '../ds'
import type { Tone } from '../ds'

interface Props {
  card: KanbanCard
  clienteId: string
  onClose: () => void
  etapas?: string[]
  onMoveCard?: (cardId: string, etapa: string) => void
}

const TEMP_LABEL: Record<'quente' | 'morno' | 'frio', string> = {
  quente: 'Quente',
  morno:  'Morno',
  frio:   'Frio',
}

function ScoreBar({ label, value }: { label: string; value: number }) {
  const pct = Math.round(value * 10) // score_interesse vem 0–10
  // Alinha com semanticColors.latencia (rápido/médio/lento usa a mesma
  // escala verde/amarelo/vermelho) — aqui significa "interesse alto/médio/baixo".
  const color =
    pct >= 70 ? semanticColors.latencia.rapido
    : pct >= 40 ? semanticColors.latencia.medio
    : semanticColors.latencia.lento
  return (
    <div className="rounded-lg p-3 text-center flex-1" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
      <div className="text-xl font-bold text-white mb-1">{pct}%</div>
      <div className="h-1.5 rounded-full overflow-hidden mb-1.5" style={{ background: 'var(--bg-elevated)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  )
}

export default function LeadModal({ card, clienteId, onClose, etapas, onMoveCard }: Props) {
  const [expandedAnalise, setExpandedAnalise] = useState<string | null>(null)
  const [showMoveMenu, setShowMoveMenu] = useState(false)

  const { data: analyses = [], isLoading } = useQuery({
    queryKey: ['lead-analyses', clienteId, card.id],
    queryFn: () => kanbanApi.getLeadAnalyses(clienteId, card.id),
  })

  const tempKey = normalizeTemperatura(card.temperatura)
  const tempTone: Tone | null = tempKey ? `temperatura:${tempKey}` : null
  const tempLabel = tempKey ? TEMP_LABEL[tempKey] : null

  const handleMove = (etapa: string) => {
    onMoveCard?.(card.id, etapa)
    setShowMoveMenu(false)
  }

  // Avatar usa LeadAvatar (iniciais automáticas + anel pela temperatura).
  // O cálculo manual antigo ficou desnecessário.

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <LeadAvatar
              name={card.nome}
              fallback={card.whatsapp}
              temperatura={card.temperatura}
              size={36}
            />
            <div>
              <h2 className="text-base font-semibold text-white leading-tight">
                {card.nome || card.whatsapp}
              </h2>
              <p className="text-xs text-gray-500 flex items-center gap-1.5 mt-0.5 font-mono-data">
                <ChannelIcon channel="whatsapp" size={10} />
                {card.whatsapp}
                {card.etapa_funil && (
                  <>
                    <span className="text-gray-700">·</span>
                    <span
                      className={clsx(
                        'px-1.5 py-0.5 rounded text-xs',
                        card.etapa_funil === 'Fechado' ? 'bg-green-900/60 text-green-400' :
                        card.etapa_funil === 'Perdido' ? 'bg-red-900/60 text-red-400' :
                        'bg-gray-700/60 text-gray-300'
                      )}
                    >
                      {card.etapa_funil}
                    </span>
                  </>
                )}
              </p>
              {/* Deep links — estamos no Kanban, então Kanban é ocultado. */}
              <OpenActions
                leadId={card.id}
                excludeCurrent="kanban"
                showDashboard
                className="mt-1.5"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Move stage button */}
            {etapas && etapas.length > 0 && onMoveCard && (
              <div className="relative">
                <button
                  onClick={() => setShowMoveMenu((v) => !v)}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
                  style={{
                    background: 'rgba(11,150,146,0.12)',
                    color: '#25c8bd',
                    border: '1px solid rgba(11,150,146,0.25)',
                  }}
                >
                  Mover etapa
                  <ChevronRight size={12} />
                </button>
                {showMoveMenu && (
                  <div
                    className="absolute right-0 top-full mt-1 rounded-xl py-1 shadow-2xl z-10 min-w-[160px]"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                  >
                    {etapas
                      .filter((e) => e !== card.etapa_funil)
                      .map((etapa) => (
                        <button
                          key={etapa}
                          onClick={() => handleMove(etapa)}
                          className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                        >
                          {etapa}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Scores row — only if we have analysis data */}
          {card.ultima_analise && (
            <div className="flex gap-3">
              {tempTone && tempLabel && (
                <div
                  className="rounded-lg p-3 text-center flex-1"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
                >
                  <div className="flex items-center justify-center mb-1">
                    <Pill tone={tempTone} dot>{tempLabel}</Pill>
                  </div>
                  <p className="text-xs text-gray-500">Temperatura</p>
                </div>
              )}

              {card.ultima_analise.score_interesse !== undefined &&
                card.ultima_analise.score_interesse !== null && (
                  <ScoreBar label="Score Interesse" value={card.ultima_analise.score_interesse} />
                )}

              {card.score !== undefined && card.score !== null && !card.ultima_analise.score_interesse && (
                <div
                  className="rounded-lg p-3 text-center flex-1"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
                >
                  <div className="text-xl font-bold text-white mb-1">{card.score}</div>
                  <p className="text-xs text-gray-500">Score</p>
                </div>
              )}
            </div>
          )}

          {/* KPI Generico */}
          {card.kpi_generico && Object.keys(card.kpi_generico).length > 0 && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={13} className="text-brand-400" />
                <p className="text-xs font-medium text-gray-300">
                  KPIs{card.nicho ? ` — ${card.nicho}` : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                {Object.entries(card.kpi_generico).map(([key, value]) => {
                  if (value === null || value === undefined || value === '') return null
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  return (
                    <div key={key} className="flex justify-between text-xs">
                      <span className="text-gray-500 truncate mr-2">{label}</span>
                      <span className="text-gray-300 truncate text-right">
                        {typeof value === 'boolean' ? (value ? 'Sim' : 'Não') : String(value)}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* KPI padronizado (fallback) */}
          {!card.kpi_generico && card.kpi && (
            <div className="rounded-xl p-4" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 size={13} className="text-brand-400" />
                <p className="text-xs font-medium text-gray-300">KPIs</p>
              </div>
              <div className="space-y-1.5">
                {Object.entries(card.kpi).map(([key, value]) => {
                  if (value === null || value === undefined || value === '') return null
                  const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                  return <Row key={key} label={label} value={String(value)} />
                })}
              </div>
            </div>
          )}

          {/* Analyses */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Brain size={15} className="text-brand-400" />
              <h3 className="text-sm font-medium text-gray-200">
                Análises
                <span className="text-gray-600 ml-1 font-normal">({analyses.length})</span>
              </h3>
            </div>

            {isLoading && (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-brand-500" />
              </div>
            )}

            <div className="space-y-2">
              {analyses.map((analise) => (
                <div
                  key={analise.id}
                  className="rounded-xl overflow-hidden"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
                >
                  <button
                    onClick={() => setExpandedAnalise(expandedAnalise === analise.id ? null : analise.id)}
                    className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-800/40 transition-colors"
                  >
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span
                        className="text-xs px-2 py-0.5 rounded font-mono"
                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-2)' }}
                      >
                        v{analise.versao}
                      </span>
                      <span className="text-xs text-gray-400">
                        {format(new Date(analise.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </span>
                      {analise.sentimento && (() => {
                        // Centraliza a cor em semanticColors.variacao (up/flat/down).
                        const key = normalizeSentimento(analise.sentimento)
                        const variTone: Tone =
                          key === 'positivo' ? 'variacao:up'
                          : key === 'negativo' ? 'variacao:down'
                          : 'variacao:flat'
                        return (
                          <Pill tone={variTone}>
                            {analise.sentimento}
                          </Pill>
                        )
                      })()}
                      {analise.score_interesse !== undefined && analise.score_interesse !== null && (
                        <span className="text-xs text-brand-400 font-mono">
                          {Math.round(analise.score_interesse * 10)}%
                        </span>
                      )}
                    </div>
                    {expandedAnalise === analise.id
                      ? <ChevronUp size={13} className="text-gray-500" />
                      : <ChevronDown size={13} className="text-gray-500" />}
                  </button>

                  {expandedAnalise === analise.id && (
                    <div className="px-4 pb-4 border-t border-gray-800/60 pt-3 space-y-3">
                      {analise.resumo_curto && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Resumo</p>
                          <p className="text-sm text-gray-200 leading-relaxed">{analise.resumo_curto}</p>
                        </div>
                      )}
                      {analise.intencao && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Intenção</p>
                          <p className="text-sm text-gray-200">{analise.intencao}</p>
                        </div>
                      )}
                      {analise.proximo_passo && (
                        <div
                          className="rounded-lg p-3"
                          style={{ background: 'rgba(11,150,146,0.06)', border: '1px solid rgba(11,150,146,0.15)' }}
                        >
                          <p className="text-xs text-brand-400 font-medium mb-1 flex items-center gap-1">
                            <Zap size={10} />
                            Próximo passo
                          </p>
                          <p className="text-sm text-gray-200">{analise.proximo_passo}</p>
                        </div>
                      )}
                      {analise.kpi && (
                        <div className="rounded-lg p-3 space-y-1.5" style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}>
                          <div className="flex items-center gap-2 mb-2">
                            <BarChart3 size={12} className="text-brand-400" />
                            <p className="text-xs font-medium text-gray-300">KPIs da Análise</p>
                          </div>
                          {Object.entries(analise.kpi).map(([key, value]) => {
                            if (value === null || value === undefined || value === '') return null
                            const label = key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                            return <Row key={key} label={label} value={String(value)} />
                          })}
                        </div>
                      )}
                      {analise.detalhe?.resumo_completo && (
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Análise completa</p>
                          <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {analise.detalhe.resumo_completo}
                          </p>
                        </div>
                      )}
                      <div className="text-xs text-gray-600 flex gap-3 pt-1">
                        {analise.modelo_ia && <span>modelo: {analise.modelo_ia}</span>}
                        {analise.tokens_consumidos && <span>tokens: {analise.tokens_consumidos}</span>}
                        {analise.total_msgs && <span>msgs: {analise.total_msgs}</span>}
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {!isLoading && analyses.length === 0 && (
                <div
                  className="rounded-xl"
                  style={{ background: 'var(--bg-deep)', border: '1px solid var(--border)' }}
                >
                  <EmptyState
                    variant="empty"
                    size="sm"
                    icon={Brain}
                    title="Nenhuma análise disponível ainda"
                    description="As análises serão processadas automaticamente"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs gap-2">
      <span className="text-gray-500 truncate">{label}</span>
      <span className="text-gray-300 text-right max-w-[55%] truncate">{value}</span>
    </div>
  )
}
