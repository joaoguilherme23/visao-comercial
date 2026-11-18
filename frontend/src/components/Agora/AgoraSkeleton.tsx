import Skeleton from '../ui/Skeleton'

/**
 * Skeleton da pagina /agora (v2 — temporal).
 * Header real (titulo + pilula + refresh) + 2 secoes temporais simuladas:
 * divisoria fina com label + contador, e 3 cards com borda lateral cinza
 * (placeholder da cor do motivo).
 */
export function AgoraSkeleton() {
  return (
    <div className="max-w-[960px] mx-auto px-6 py-6">
      {/* Header placeholder */}
      <div className="flex items-end justify-between gap-3 mb-6">
        <div className="flex-1 space-y-2">
          <Skeleton width={120} height={28} />
          <Skeleton width="60%" height={13} />
        </div>
        <div className="flex items-center gap-2">
          <Skeleton width={70} height={26} shape="pill" />
          <Skeleton width={28} height={28} />
        </div>
      </div>

      {/* 2 secoes temporais */}
      {[0, 1].map((b) => (
        <section key={b} className="mb-6">
          {/* Header temporal: divisoria fina + label + contagem */}
          <div
            className="flex items-center justify-between pb-2 mb-3"
            style={{ borderBottom: '1px solid var(--border-subtle)' }}
          >
            <div className="flex items-center gap-2">
              <Skeleton width={6} height={6} shape="circle" />
              <Skeleton width={80} height={11} />
            </div>
            <Skeleton width={24} height={18} shape="pill" />
          </div>

          {/* 3 cards com borda lateral cinza */}
          <div className="space-y-2">
            {[0, 1, 2].map((c) => (
              <div
                key={c}
                className="rounded-xl p-4 flex items-center gap-4"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-subtle)',
                  borderLeft: '4px solid var(--border-subtle)',
                  borderRadius: '12px',
                }}
              >
                <Skeleton width={40} height={40} shape="circle" />
                <div className="flex-1 space-y-2 min-w-0">
                  <div className="flex items-center gap-2">
                    <Skeleton width="40%" height={14} />
                    <Skeleton width={60} height={16} shape="pill" />
                  </div>
                  <Skeleton width="30%" height={11} />
                  <Skeleton width="70%" height={12} />
                </div>
                <Skeleton width={100} height={32} />
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
