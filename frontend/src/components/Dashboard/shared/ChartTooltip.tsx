// ── Custom tooltip ──────────────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: {
  active?: boolean
  payload?: Array<{ color?: string; value?: number | string; unit?: string; name?: string }>
  label?: string
}) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--tooltip-bg)', border: '1px solid var(--tooltip-border)', borderRadius: 8, padding: '8px 12px' }}>
      {label && <p style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>{label}</p>}
      {payload.map((p, i) => (
        <p key={i} style={{ fontSize: 14, fontWeight: 700, color: p.color || '#f1f5f9' }}>
          {typeof p.value === 'number' ? p.value.toLocaleString('pt-BR') : p.value}
          {p.unit || ''}
        </p>
      ))}
    </div>
  )
}

export default ChartTooltip
