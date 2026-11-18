import { Phone, Users, CheckCircle2, TrendingUp, Star, MessageSquare, Flame, Thermometer, Snowflake } from 'lucide-react'
import { ComparativoNumeroItem } from '../../api/dashboard'

interface Props {
  data: ComparativoNumeroItem[]
  isLoading: boolean
}

const TEMP_COLORS = {
  quente: '#ef4444',
  morno:  '#f97316',
  frio:   '#3b82f6',
}

function MetricCell({ icon: Icon, label, value, color }: {
  icon: React.ElementType
  label: string
  value: string | number
  color?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center gap-1.5">
        <Icon size={12} style={{ color: color || 'var(--text-2)' }} />
        <span className="text-xs" style={{ color: 'var(--text-2)' }}>{label}</span>
      </div>
      <span className="text-base font-bold" style={{ color: color || 'var(--text-1)' }}>
        {value}
      </span>
    </div>
  )
}

function TemperaturaBar({ quente, morno, frio }: { quente: number; morno: number; frio: number }) {
  const total = quente + morno + frio || 1
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs" style={{ color: 'var(--text-2)' }}>Temperatura</span>
      <div className="flex rounded-full overflow-hidden h-2 gap-0.5">
        {quente > 0 && (
          <div
            style={{ width: `${(quente / total) * 100}%`, background: TEMP_COLORS.quente, borderRadius: 4 }}
            title={`Quente: ${quente}`}
          />
        )}
        {morno > 0 && (
          <div
            style={{ width: `${(morno / total) * 100}%`, background: TEMP_COLORS.morno, borderRadius: 4 }}
            title={`Morno: ${morno}`}
          />
        )}
        {frio > 0 && (
          <div
            style={{ width: `${(frio / total) * 100}%`, background: TEMP_COLORS.frio, borderRadius: 4 }}
            title={`Frio: ${frio}`}
          />
        )}
      </div>
      <div className="flex gap-3">
        {[
          { icon: Flame, label: quente, color: TEMP_COLORS.quente },
          { icon: Thermometer, label: morno, color: TEMP_COLORS.morno },
          { icon: Snowflake, label: frio, color: TEMP_COLORS.frio },
        ].map(({ icon: Icon, label, color }) => (
          <div key={color} className="flex items-center gap-1">
            <Icon size={10} style={{ color }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function ComparativoNumeros({ data, isLoading }: Props) {
  if (isLoading) {
    // Shimmer consistente com o resto da UI (ver components/ui/Skeleton).
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {[1, 2].map(i => (
          <div
            key={i}
            className="rounded-xl p-5"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
          >
            <div
              className="h-4 w-32 rounded mb-4 animate-shimmer"
              style={{ background: 'var(--skeleton-base)' }}
            />
            <div className="grid grid-cols-2 gap-4">
              {[1, 2, 3, 4].map(j => (
                <div
                  key={j}
                  className="h-10 rounded animate-shimmer"
                  style={{ background: 'var(--skeleton-base)' }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!data || data.length < 2) return null

  // Identifica o melhor em cada métrica para destacar
  const maxLeads = Math.max(...data.map(d => d.total_leads))
  const maxConversao = Math.max(...data.map(d => d.taxa_conversao))
  const maxScore = Math.max(...data.map(d => d.score_medio ?? 0))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {data.map((item) => {
        const isBestLeads = item.total_leads === maxLeads && maxLeads > 0
        const isBestConversao = item.taxa_conversao === maxConversao && maxConversao > 0
        const isBestScore = (item.score_medio ?? 0) === maxScore && maxScore > 0

        return (
          <div
            key={item.numero_id}
            className="rounded-xl p-5 flex flex-col gap-5"
            style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
            }}
          >
            {/* Header */}
            <div className="flex items-center gap-3">
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'var(--brand-500, #087f7c)20', border: '1px solid var(--brand-500, #087f7c)40' }}
              >
                <Phone size={16} style={{ color: 'var(--brand-500, #087f7c)' }} />
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--text-1)' }}>
                  {item.nome}
                </p>
                <p className="text-xs font-mono" style={{ color: 'var(--text-3)' }}>
                  {item.numero.replace(/(\d{2})(\d{2})(\d{4,5})(\d{4})/, '+$1 ($2) $3-$4')}
                </p>
              </div>
            </div>

            {/* Métricas em grid */}
            <div className="grid grid-cols-2 gap-4">
              <MetricCell
                icon={Users}
                label="Total leads"
                value={item.total_leads.toLocaleString('pt-BR')}
                color={isBestLeads ? '#22c55e' : undefined}
              />
              <MetricCell
                icon={CheckCircle2}
                label="Fechados"
                value={item.total_fechados.toLocaleString('pt-BR')}
              />
              <MetricCell
                icon={TrendingUp}
                label="Conversão"
                value={`${item.taxa_conversao}%`}
                color={isBestConversao ? '#22c55e' : undefined}
              />
              <MetricCell
                icon={Star}
                label="Score médio"
                value={item.score_medio != null ? item.score_medio.toFixed(1) : '—'}
                color={isBestScore ? '#f59e0b' : undefined}
              />
            </div>

            {/* Temperatura */}
            <TemperaturaBar quente={item.quente} morno={item.morno} frio={item.frio} />

            {/* Mensagens */}
            <div className="flex items-center gap-2 pt-1" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <MessageSquare size={12} style={{ color: 'var(--text-3)' }} />
              <span className="text-xs" style={{ color: 'var(--text-3)' }}>
                {item.total_mensagens.toLocaleString('pt-BR')} mensagens trocadas
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
