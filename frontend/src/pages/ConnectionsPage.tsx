import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { tenantsApi } from '../api/tenants'
import { useTenantStore } from '../store/tenantStore'
import { NumeroBot, UazapiStatus } from '../types'
import {
  Plus, Trash2, Plug, Loader2, Wifi, WifiOff, QrCode,
  RefreshCw, CheckCircle2, X, Phone, AlertCircle,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Pill, EmptyState } from '../components/ds'

// ─── Helpers ─────────────────────────────────────────────────────────────────

function syncLabel(syncState: string | null): { label: string; tone: 'status:active' | 'status:pending' | 'status:danger' } {
  switch (syncState) {
    case 'receiving': return { label: 'Sincronização recebendo', tone: 'status:active' }
    case 'sync_enabled':
    case 'webhook_configured': return { label: 'Sincronização pronta', tone: 'status:active' }
    case 'connection_mismatch': return { label: 'Erro: telefone divergente', tone: 'status:danger' }
    case 'disconnected': return { label: 'Sincronização pendente', tone: 'status:pending' }
    case 'pending_connection':
    case 'connecting':
    case 'connected':
    case 'history': return { label: 'Sincronização em preparação', tone: 'status:pending' }
    default: return { label: syncState ? `Sincronização: ${syncState}` : 'Sincronização pendente', tone: 'status:pending' }
  }
}

function formatDate(value: string | null): string {
  if (!value) return 'Ainda não registrada'
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? 'Data indisponível' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(date)
}

function formatQr(raw: string): string {
  // Uazapi já retorna "data:image/png;base64,..." — fallback para base64 puro
  if (raw.startsWith('data:')) return raw
  if (raw.startsWith('iVBOR') || raw.startsWith('/9j/')) return `data:image/png;base64,${raw}`
  return raw // raw QR string — improvável mas seguro
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: 'connected' | 'connecting' | 'disconnected' | 'unknown' }) {
  if (status === 'connected')
    return (
      <Pill tone="status:active" icon={CheckCircle2}>
        Conectado
      </Pill>
    )
  if (status === 'connecting')
    return (
      <Pill tone="status:pending" icon={Loader2} className="[&_svg]:animate-spin">
        Conectando…
      </Pill>
    )
  if (status === 'unknown')
    return (
      <Pill tone="status:pending" icon={AlertCircle}>
        Status indisponível
      </Pill>
    )
  return (
    <Pill tone="neutral" variant="ghost" icon={WifiOff}>
      Desconectado
    </Pill>
  )
}

// ─── QR Code Modal ───────────────────────────────────────────────────────────

function QrModal({
  tenantId,
  numero,
  onClose,
  onConnected,
}: {
  tenantId: string
  numero: NumeroBot
  onClose: () => void
  onConnected: () => void
}) {
  const [phase, setPhase] = useState<'loading' | 'qr' | 'connected' | 'error'>('loading')
  const [qrData, setQrData] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const calledRef = useRef(false)
  const qc = useQueryClient()

  const QR_TIMEOUT = 120 // segundos

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }

  // Effect 1 — dispara connectNumero uma única vez (guard contra StrictMode)
  // Não usa cancelled flag: state updates pós-unmount são seguros no React 18
  // e o polling é controlado pelo Effect 2 reativo ao phase
  useEffect(() => {
    if (calledRef.current) return
    calledRef.current = true

    async function initConnect() {
      try {
        const s: UazapiStatus = await tenantsApi.connectNumero(tenantId, numero.id)
        if (s.qr_code) setQrData(s.qr_code)
        if (s.status === 'connected') {
          setPhase('connected')
          qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
          setTimeout(() => { onConnected(); onClose() }, 2000)
        } else {
          setPhase('qr')
        }
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao conectar'
        setErrorMsg(msg)
        setPhase('error')
      }
    }

    initConnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Effect 2 — inicia polling quando phase muda para 'qr', para no cleanup
  useEffect(() => {
    if (phase !== 'qr') return

    pollRef.current = setInterval(async () => {
      try {
        const s: UazapiStatus = await tenantsApi.getNumeroStatus(tenantId, numero.id)
        if (s.qr_code) setQrData(s.qr_code)
        if (s.status === 'connected') {
          stopPolling()
          setPhase('connected')
          qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
          setTimeout(() => { onConnected(); onClose() }, 2000)
        }
      } catch {
        // silently ignore polling errors
      }
    }, 3000)

    timerRef.current = setInterval(() => {
      setElapsed((p) => {
        if (p + 1 >= QR_TIMEOUT) {
          stopPolling()
          setPhase('error')
          setErrorMsg('QR Code expirou. Tente novamente.')
          return p
        }
        return p + 1
      })
    }, 1000)

    return () => stopPolling()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const remaining = QR_TIMEOUT - elapsed
  const progress = (elapsed / QR_TIMEOUT) * 100

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="rounded-2xl w-full max-w-sm flex flex-col"
        style={{ background: '#ffffff', border: '1px solid #cfe1e1', color: '#10252d' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2">
            <QrCode size={16} className="text-brand-400" />
            <p className="text-sm font-semibold text-[#10252d]">Conectar WhatsApp</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-500 hover:text-[#10252d] transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 flex flex-col items-center">

          {/* Loading */}
          {phase === 'loading' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <Loader2 size={36} className="animate-spin text-brand-400" />
              <p className="text-sm text-gray-400">Gerando QR Code…</p>
            </div>
          )}

          {/* QR */}
          {phase === 'qr' && (
            <>
              <p className="text-xs text-gray-500 mb-4 text-center">
                Abra o WhatsApp no celular → <strong className="text-gray-300">Dispositivos conectados</strong> → Conectar dispositivo
              </p>
              <div
                className="rounded-xl p-3 mb-4"
                style={{ background: '#fff' }}
              >
                {qrData ? (
                  <img
                    src={formatQr(qrData)}
                    alt="QR Code WhatsApp"
                    className="w-52 h-52 object-contain"
                  />
                ) : (
                  <div className="w-52 h-52 flex items-center justify-center">
                    <Loader2 size={28} className="animate-spin text-gray-400" />
                  </div>
                )}
              </div>

              {/* Timer bar */}
              <div className="w-full space-y-1.5">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${100 - progress}%`,
                      background: remaining > 30 ? 'var(--brand-500)' : remaining > 10 ? '#f97316' : '#ef4444',
                    }}
                  />
                </div>
                <p className="text-xs text-center text-gray-600">
                  Expira em {remaining}s
                </p>
              </div>
            </>
          )}

          {/* Connected */}
          {phase === 'connected' && (
            <div className="py-10 flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.15)', border: '2px solid rgba(34,197,94,0.4)' }}>
                <CheckCircle2 size={32} className="text-green-400" />
              </div>
              <p className="text-base font-semibold text-[#10252d]">Conectado!</p>
              <p className="text-sm text-gray-500">WhatsApp autenticado com sucesso.</p>
            </div>
          )}

          {/* Error */}
          {phase === 'error' && (
            <div className="py-8 flex flex-col items-center gap-3 text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle size={26} className="text-red-400" />
              </div>
              <p className="text-sm font-medium text-[#10252d]">{errorMsg}</p>
              <button
                onClick={onClose}
                className="mt-1 px-4 py-2 rounded-lg text-sm text-white transition-colors"
                style={{ background: '#009e9a' }}
              >
                Fechar
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Número card ──────────────────────────────────────────────────────────────

function NumeroCard({
  tenantId,
  numero,
  onDelete,
}: {
  tenantId: string
  numero: NumeroBot
  onDelete: () => void
}) {
  const [showQr, setShowQr] = useState(false)
  const qc = useQueryClient()
  const statusQuery = useQuery({
    queryKey: ['numero-status', tenantId, numero.id],
    queryFn: () => tenantsApi.getNumeroStatus(tenantId, numero.id),
    refetchInterval: 30_000,
  })
  const status = statusQuery.data?.status ?? 'unknown'
  const sync = syncLabel(numero.sync_state)

  const disconnectMutation = useMutation({
    mutationFn: () => tenantsApi.disconnectNumero(tenantId, numero.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
      toast.success('Número desconectado')
    },
    onError: () => toast.error('Erro ao desconectar'),
  })

  // Atualiza status real da Uazapi antes de recarregar a lista
  const refreshMutation = useMutation({
    mutationFn: () => tenantsApi.getNumeroStatus(tenantId, numero.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
    },
    onError: () => toast.error('Erro ao verificar status'),
  })

  const syncMutation = useMutation({
    mutationFn: () => tenantsApi.syncNumero(tenantId, numero.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
      qc.invalidateQueries({ queryKey: ['numero-status', tenantId, numero.id] })
      toast.success('Sincronização reconciliada')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Não foi possível preparar a sincronização. Verifique o WhatsApp conectado e tente novamente.')
    },
  })

  return (
    <>
      <div
        className="rounded-xl p-4 flex items-center gap-4"
        style={{ background: '#ffffff', border: '1px solid #cfe1e1', color: '#10252d' }}
      >
        {/* Icon */}
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 text-lg"
          style={{
            background: status === 'connected' ? 'rgba(34,197,94,0.12)' : 'rgba(11,150,146,0.1)',
            border: `1px solid ${status === 'connected' ? 'rgba(34,197,94,0.25)' : 'rgba(11,150,146,0.2)'}`,
          }}
        >
          💬
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-medium text-sm">{numero.nome || numero.numero}</p>
            {numero.nome && (
              <span className="text-xs text-gray-600 flex items-center gap-0.5">
                <Phone size={10} /> {numero.numero}
              </span>
            )}
            <StatusChip status={status} />
            <Pill tone={sync.tone} icon={sync.tone === 'status:danger' ? AlertCircle : sync.tone === 'status:active' ? CheckCircle2 : RefreshCw}>
              {sync.label}
            </Pill>
          </div>
          {statusQuery.isError && <p className="text-xs mt-1" style={{ color: '#b23b32' }}>Não foi possível consultar o status do WhatsApp. Atualize para tentar novamente.</p>}
          {statusQuery.data?.phone_matches_registered === false && <p className="text-xs mt-1" style={{ color: '#b23b32' }}>O telefone conectado é diferente do número cadastrado.</p>}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div><span className="text-gray-500">Última mensagem</span><p className="font-medium mt-0.5">{formatDate(numero.last_message_at)}</p></div>
            <div><span className="text-gray-500">Última análise</span><p className="font-medium mt-0.5">{formatDate(numero.last_analysis_at)}</p></div>
          </div>
          <p className="text-xs text-gray-500 mt-2">Recebimento: {numero.sync_enabled ? 'habilitado' : 'desabilitado'} · Análise: {numero.analysis_enabled ? 'habilitada' : 'desabilitada'}</p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {status === 'disconnected' && (
            <button
              onClick={() => setShowQr(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'rgba(11,150,146,0.12)', color: '#25c8bd', border: '1px solid rgba(11,150,146,0.25)' }}
            >
              <QrCode size={12} /> Conectar
            </button>
          )}

          {status === 'connected' && (
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-white disabled:opacity-60"
              style={{ background: '#009e9a' }}
            >
              {syncMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {sync.tone === 'status:active' ? 'Reconciliar' : 'Preparar sync'}
            </button>
          )}

          {(status === 'connected' || status === 'connecting') && (
            <button
              onClick={() => disconnectMutation.mutate()}
              disabled={disconnectMutation.isPending}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors"
              style={{ background: 'rgba(239,68,68,0.08)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              {disconnectMutation.isPending
                ? <Loader2 size={12} className="animate-spin" />
                : <WifiOff size={12} />}
              {status === 'connecting' ? 'Cancelar' : 'Desconectar'}
            </button>
          )}

          <button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            title="Verificar status na Uazapi"
            className="p-2 rounded-lg text-gray-600 hover:text-gray-300 transition-colors"
          >
            <RefreshCw size={14} className={refreshMutation.isPending ? 'animate-spin' : ''} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 rounded-lg text-gray-600 hover:text-red-400 transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {showQr && (
        <QrModal
          tenantId={tenantId}
          numero={numero}
          onClose={() => setShowQr(false)}
          onConnected={() => {
            setShowQr(false)
            qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
          }}
        />
      )}
    </>
  )
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function ConnectionsPage() {
  const { selectedTenant } = useTenantStore()
  const tenantId = selectedTenant?.id
  const qc = useQueryClient()

  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ numero: '', nome: '' })
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  const { data: numeros = [], isLoading } = useQuery({
    queryKey: ['numeros', tenantId],
    queryFn: () => tenantsApi.getNumeros(tenantId!),
    enabled: !!tenantId,
    refetchInterval: 30_000,
  })

  const createMutation = useMutation({
    mutationFn: (data: { numero: string; nome?: string }) =>
      tenantsApi.createNumero(tenantId!, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
      setShowForm(false)
      setForm({ numero: '', nome: '' })
      toast.success('Número cadastrado!')
    },
    onError: (err: unknown) => {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      toast.error(detail ?? 'Erro ao cadastrar número')
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.deleteNumero(tenantId!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['numeros', tenantId] })
      setDeleteConfirm(null)
      toast.success('Número removido')
    },
  })

  if (!selectedTenant) {
    return (
      <EmptyState
        variant="info"
        icon={Plug}
        title="Selecione uma empresa"
        description="para ver os números conectados"
      />
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.numero.trim()) return
    createMutation.mutate({
      numero: form.numero.trim(),
      nome: form.nome.trim() || undefined,
    })
  }

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-white">Números WhatsApp</h1>
          <p className="text-gray-500 text-sm mt-0.5">{selectedTenant.nome}</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all bg-brand-600 hover:bg-brand-500 hover:shadow-glow-brand-md text-white"
        >
          <Plus size={16} /> Adicionar número
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="rounded-xl p-5 space-y-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <h3 className="text-sm font-semibold text-white">Novo número</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Número (com DDI)</label>
              <input
                required
                value={form.numero}
                onChange={(e) => setForm({ ...form, numero: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                placeholder="5511999999999"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1.5 block">Nome (opcional)</label>
              <input
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500"
                style={{ background: 'var(--input-bg)', border: '1px solid var(--input-border)' }}
                placeholder="Atendimento principal"
              />
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm({ numero: '', nome: '' }) }}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-500 text-white rounded-lg text-sm transition-colors disabled:opacity-60"
            >
              {createMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              Salvar
            </button>
          </div>
        </form>
      )}

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl p-4 animate-pulse" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}>
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-xl" style={{ background: 'var(--bg-elevated)' }} />
                <div className="flex-1 space-y-2">
                  <div className="h-3 w-40 rounded" style={{ background: 'var(--bg-elevated)' }} />
                  <div className="h-2.5 w-24 rounded" style={{ background: 'var(--bg-elevated)' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : numeros.length === 0 ? (
        <div className="rounded-xl p-12 text-center" style={{ background: 'var(--bg-surface)', border: '1.5px dashed var(--border-subtle)' }}>
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
            style={{ background: 'rgba(11,150,146,0.08)', border: '1px solid rgba(11,150,146,0.15)' }}
          >
            <Wifi size={22} className="text-brand-400 opacity-60" />
          </div>
          <h4 className="text-sm font-semibold text-white mb-1">Nenhum número cadastrado</h4>
          <p className="text-xs text-gray-600 mb-5">Adicione um número e escaneie o QR Code para conectar ao WhatsApp</p>
          <button
            onClick={() => setShowForm(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-brand-600 hover:bg-brand-500 text-white transition-colors"
          >
            + Adicionar número
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {numeros.map((n) => (
            <NumeroCard
              key={n.id}
              tenantId={tenantId!}
              numero={n}
              onDelete={() => setDeleteConfirm(n.id)}
            />
          ))}
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="rounded-2xl p-6 w-full max-w-sm" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <Trash2 size={20} className="text-red-400" />
            </div>
            <h3 className="text-base font-semibold text-white text-center mb-1">Remover número?</h3>
            <p className="text-sm text-gray-500 text-center mb-5">
              O número será removido do sistema. A instância Uazapi não será deletada automaticamente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2 rounded-lg text-sm text-gray-400 hover:text-white transition-colors"
                style={{ background: 'var(--bg-elevated)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteConfirm)}
                disabled={deleteMutation.isPending}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors"
                style={{ background: '#dc2626' }}
              >
                {deleteMutation.isPending && <Loader2 size={13} className="animate-spin" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
