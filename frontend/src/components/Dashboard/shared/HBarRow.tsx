// ── Horizontal Bar Row (shared primitive) ─────────────────────────────────────
export default function HBarRow({
  label,
  total,
  pct,
  color,
  maxPct = 100,
  onClick,
  labelClassName = 'w-28 truncate',
  compact = false,
}: {
  label: string
  total: number
  pct: number
  color: string
  maxPct?: number
  onClick?: () => void
  labelClassName?: string
  compact?: boolean
}) {
  const width = maxPct > 0 ? Math.min((pct / maxPct) * 100, 100) : 0
  const barH = compact ? 'h-4' : 'h-5'
  return (
    <div className={`flex items-center gap-3 ${onClick ? 'cursor-pointer hover:opacity-80' : ''}`} onClick={onClick}>
      <span className={`text-xs text-gray-400 flex-shrink-0 ${labelClassName}`} title={label}>{label}</span>
      <div className={`flex-1 ${barH} rounded overflow-hidden`} style={{ background: 'var(--bg-elevated)' }}>
        <div
          className={`h-full rounded flex items-center justify-end pr-2 transition-all duration-500`}
          style={{ width: `${Math.max(width, 2)}%`, background: color, minWidth: 4 }}
        >
          {!compact && width >= 20 && (
            <span className="text-xs font-semibold text-white/90" style={{ fontSize: 10 }}>
              {total.toLocaleString('pt-BR')} ({pct}%)
            </span>
          )}
        </div>
      </div>
      {(compact || width < 20) && (
        <span className="text-xs font-semibold text-gray-300 flex-shrink-0" style={{ fontSize: 11 }}>
          {total.toLocaleString('pt-BR')} ({pct}%)
        </span>
      )}
    </div>
  )
}
