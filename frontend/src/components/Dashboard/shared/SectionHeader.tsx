// ── Section Header ─────────────────────────────────────────────────────────────
export default function SectionHeader({ label, color }: { label: string; color?: string }) {
  return (
    <div className="flex items-center gap-3 mb-1">
      {color && <div className="w-1 h-4 rounded-full flex-shrink-0" style={{ background: color }} />}
      <p className="text-xs font-bold uppercase tracking-widest" style={{ color: color ?? 'var(--text-3)' }}>
        {label}
      </p>
      <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
    </div>
  )
}
