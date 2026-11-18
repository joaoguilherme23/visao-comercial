import { Info } from 'lucide-react'

export default function InfoTooltip({ text }: { text?: string }) {
  if (!text) return null
  return (
    <div className="relative group flex-shrink-0">
      <div
        className="w-5 h-5 rounded-full border flex items-center justify-center text-gray-500 hover:text-white transition-colors"
        style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
      >
        <Info size={12} />
      </div>
      <div
        className="pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-150 absolute z-30 mt-1 w-64"
        style={{ left: '50%', transform: 'translateX(-50%)', maxWidth: 280 }}
      >
        <div
          className="rounded-lg border shadow-xl p-3 text-xs leading-relaxed text-gray-100"
          style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', boxShadow: '0 14px 30px rgba(0,0,0,0.35)' }}
        >
          {text}
        </div>
      </div>
    </div>
  )
}
