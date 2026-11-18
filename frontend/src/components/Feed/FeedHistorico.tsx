import { useQuery } from '@tanstack/react-query'
import { Loader2, Brain } from 'lucide-react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'

import { kanbanApi } from '../../api/kanban'

interface Props {
  clienteId: string
  leadId: string
}

function fmtDate(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

export default function FeedHistorico({ clienteId, leadId }: Props) {
  const { data, isLoading, isError } = useQuery({
    queryKey: ['feed-historico', clienteId, leadId],
    queryFn: () => kanbanApi.getLeadAnalyses(clienteId, leadId),
    enabled: !!clienteId && !!leadId,
    staleTime: 30_000,
  })

  if (isLoading) {
    return (
      <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
        <Loader2 size={12} className="animate-spin" />
        Carregando histórico…
      </div>
    )
  }
  if (isError) {
    return <p className="text-xs" style={{ color: '#f87171' }}>Erro ao carregar histórico.</p>
  }
  if (!data || data.length === 0) {
    return (
      <p className="text-xs italic" style={{ color: 'var(--text-3)' }}>
        Sem análises anteriores para este lead.
      </p>
    )
  }

  return (
    <ul className="space-y-2">
      {data.map((a, idx) => (
        <li
          key={a.id}
          className="rounded-lg px-3 py-2"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            borderLeft: idx === 0 ? '3px solid #25c8bd' : '1px solid var(--border-subtle)',
          }}
        >
          <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
            <span className="flex items-center gap-1.5">
              <Brain size={11} />
              {idx === 0 ? (
                <span style={{ color: '#a5b4fc' }} className="font-medium">Análise atual</span>
              ) : (
                <span>Análise v{a.versao}</span>
              )}
            </span>
            <span>{fmtDate(a.created_at)}</span>
          </div>
          {a.resumo_curto && (
            <p className="text-sm leading-relaxed mb-1" style={{ color: 'var(--text-1)' }}>
              {a.resumo_curto}
            </p>
          )}
          {a.proximo_passo && (
            <p className="text-xs flex items-start gap-1.5" style={{ color: '#a5b4fc' }}>
              <span className="flex-shrink-0">→</span>
              {a.proximo_passo}
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}
