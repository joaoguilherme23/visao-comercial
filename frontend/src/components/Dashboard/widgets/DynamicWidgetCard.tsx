import { useQuery } from '@tanstack/react-query'
import {
  getWidgetData,
  type AnaliseWidgetOut,
  type AnaliseWidgetDataOut,
  type PeriodoParams,
} from '../../../api/dashboard'
import WidgetRenderer from '../WidgetRenderer'

export default function DynamicWidgetCard({
  widget,
  clienteId,
  periodoParams,
  onDrillItem,
}: {
  widget: AnaliseWidgetOut
  clienteId: string
  periodoParams: PeriodoParams
  onDrillItem?: (campo: string, label: string, widgetLabel: string) => void
}) {
  const { data, isLoading } = useQuery<AnaliseWidgetDataOut>({
    queryKey: ['widget-data', clienteId, widget.id, periodoParams],
    queryFn: () =>
      getWidgetData(clienteId, widget.id, {
        data_inicio: periodoParams.data_inicio,
        data_fim: periodoParams.data_fim,
      }),
    enabled: !!clienteId,
  })

  return (
    <div
      className="rounded-2xl p-4 flex flex-col"
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}
    >
      <div className="flex items-center justify-between mb-3">
        <p
          className="text-xs font-semibold tracking-widest uppercase"
          style={{ color: 'var(--text-2)' }}
        >
          {widget.label}
        </p>
        {widget.descricao && (
          <span className="text-gray-600 cursor-help text-xs" title={widget.descricao}>
            ℹ️
          </span>
        )}
      </div>
      <div className="flex-1">
        <WidgetRenderer
          widget={data ?? null}
          isLoading={isLoading}
          onItemClick={onDrillItem && widget.campo
            ? (label) => onDrillItem(widget.campo as string, label, widget.label)
            : undefined
          }
        />
      </div>
      {data && (
        <p className="text-xs text-gray-600 mt-2">Base: {data.total_base} análises</p>
      )}
    </div>
  )
}
