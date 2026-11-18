import { useEffect, useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createPortal } from 'react-dom'
import {
  X, Building2, MapPin, Phone, User as UserIcon, Settings, ChevronDown, ChevronRight,
  Plus, Trash2, Upload, Loader2, AlertTriangle,
} from 'lucide-react'
import toast from 'react-hot-toast'

import { tenantsApi } from '../../api/tenants'
import { Tenant, ContatoEmpresa } from '../../types'
import { useAuthStore } from '../../store/authStore'
import { formatCNPJ, isValidCNPJ, unmaskCNPJ } from '../../lib/cnpj'
import { formatCEP, fetchAddressByCEP, unmaskCEP } from '../../lib/cep'
import { resolveAvatarUrl } from '../../lib/avatarUrl'

interface Props {
  /** null = criar nova empresa; Tenant = editar existente. */
  tenant: Tenant | null
  /** Quando true, mostra apenas campos do subset cadastrais (admin cliente). */
  restrictedMode?: boolean
  onClose: () => void
}

const UFs = [
  'AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT',
  'PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO',
]

const PLANOS = ['basico', 'pro', 'enterprise']
const TIMEZONES = [
  'America/Sao_Paulo', 'America/Manaus', 'America/Cuiaba', 'America/Belem',
  'America/Fortaleza', 'America/Recife', 'America/Bahia', 'America/Maceio',
]

interface SectionProps {
  title: string
  icon: React.ElementType
  isOpen: boolean
  onToggle: () => void
  children: React.ReactNode
}

function Section({ title, icon: Icon, isOpen, onToggle, children }: SectionProps) {
  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium transition-colors"
        style={{ color: 'var(--text-1)' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <span className="flex items-center gap-2.5">
          <Icon size={15} style={{ color: 'var(--text-3)' }} />
          {title}
        </span>
        {isOpen ? <ChevronDown size={14} style={{ color: 'var(--text-3)' }} /> : <ChevronRight size={14} style={{ color: 'var(--text-3)' }} />}
      </button>
      {isOpen && <div className="px-5 pb-4 space-y-3">{children}</div>}
    </div>
  )
}

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className="text-xs font-medium block mb-1" style={{ color: 'var(--text-2)' }}>
        {label}{required && <span style={{ color: '#f87171' }}> *</span>}
      </span>
      {children}
      {hint && !error && <span className="text-[10px] mt-0.5 block" style={{ color: 'var(--text-3)' }}>{hint}</span>}
      {error && <span className="text-[10px] mt-0.5 block" style={{ color: '#f87171' }}>{error}</span>}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '7px 10px',
  fontSize: 13,
  background: 'var(--bg-card)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  color: 'var(--text-1)',
  outline: 'none',
}

export default function TenantDrawer({ tenant, restrictedMode = false, onClose }: Props) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const isCreating = !tenant
  const isSuperadmin = !!user?.is_superadmin

  // Estado controlado pra cada campo
  const [form, setForm] = useState({
    // Identificação
    nome: tenant?.nome ?? '',
    slug: tenant?.slug ?? '',
    cnpj: tenant?.cnpj ?? '',
    razao_social: tenant?.razao_social ?? '',
    nicho: tenant?.nicho ?? '',
    plano: tenant?.plano ?? 'basico',
    // Endereço
    endereco_cep: tenant?.endereco_cep ?? '',
    endereco_logradouro: tenant?.endereco_logradouro ?? '',
    endereco_numero: tenant?.endereco_numero ?? '',
    endereco_complemento: tenant?.endereco_complemento ?? '',
    endereco_bairro: tenant?.endereco_bairro ?? '',
    endereco_cidade: tenant?.endereco_cidade ?? '',
    endereco_uf: tenant?.endereco_uf ?? '',
    // Contatos (array)
    contatos: (tenant?.contatos ?? []) as ContatoEmpresa[],
    // Responsável
    responsavel_nome: tenant?.responsavel_nome ?? '',
    responsavel_cargo: tenant?.responsavel_cargo ?? '',
    responsavel_email: tenant?.responsavel_email ?? '',
    responsavel_telefone: tenant?.responsavel_telefone ?? '',
    // Configurações
    timezone: tenant?.timezone ?? 'America/Sao_Paulo',
    nome_agente: tenant?.nome_agente ?? '',
    budget_brl_diario: tenant?.budget_brl_diario != null ? String(tenant.budget_brl_diario) : '',
  })

  // Seções expansíveis — primeira sempre aberta
  const [openSections, setOpenSections] = useState({
    identificacao: true,
    endereco: false,
    contatos: false,
    responsavel: false,
    config: false,
  })
  const toggleSection = (key: keyof typeof openSections) =>
    setOpenSections((s) => ({ ...s, [key]: !s[key] }))

  // ESC fecha + lock scroll do body
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  // ── CEP — busca automática quando completar 8 dígitos ────────────────────
  const cepAbortRef = useRef<AbortController | null>(null)
  const [cepLoading, setCepLoading] = useState(false)

  async function handleCEPChange(value: string) {
    const masked = formatCEP(value)
    setForm((f) => ({ ...f, endereco_cep: masked }))
    const digits = unmaskCEP(value)
    if (digits.length !== 8) return
    cepAbortRef.current?.abort()
    cepAbortRef.current = new AbortController()
    setCepLoading(true)
    try {
      const addr = await fetchAddressByCEP(digits, cepAbortRef.current.signal)
      if (addr) {
        setForm((f) => ({
          ...f,
          endereco_logradouro: addr.logradouro || f.endereco_logradouro,
          endereco_bairro: addr.bairro || f.endereco_bairro,
          endereco_cidade: addr.cidade || f.endereco_cidade,
          endereco_uf: addr.uf || f.endereco_uf,
        }))
      }
    } finally {
      setCepLoading(false)
    }
  }

  // ── CNPJ — formata enquanto digita + valida ao perder foco ───────────────
  const cnpjUnmasked = unmaskCNPJ(form.cnpj || '')
  const cnpjError = cnpjUnmasked && cnpjUnmasked.length === 14 && !isValidCNPJ(form.cnpj)
    ? 'CNPJ inválido'
    : undefined

  // ── Avatar (logo) — upload e delete ──────────────────────────────────────
  const [avatarUrl, setAvatarUrl] = useState<string | null | undefined>(tenant?.foto_url)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const uploadAvatarMutation = useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => tenantsApi.uploadAvatar(id, file),
    onSuccess: (updated) => {
      setAvatarUrl(updated.foto_url)
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Logo atualizada')
    },
    onError: () => toast.error('Erro ao enviar logo'),
  })

  const deleteAvatarMutation = useMutation({
    mutationFn: (id: string) => tenantsApi.deleteAvatar(id),
    onSuccess: () => {
      setAvatarUrl(null)
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Logo removida')
    },
    onError: () => toast.error('Erro ao remover logo'),
  })

  function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (!tenant) {
      toast.error('Salve a empresa primeiro pra enviar a logo')
      e.target.value = ''
      return
    }
    if (f.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande (máx 5MB)')
      e.target.value = ''
      return
    }
    uploadAvatarMutation.mutate({ id: tenant.id, file: f })
    e.target.value = ''
  }

  // ── Save (create/update) ─────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: tenantsApi.create,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Empresa criada!')
      onClose()
    },
    onError: () => toast.error('Erro ao criar empresa'),
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Tenant> }) =>
      restrictedMode
        ? tenantsApi.updateDadosCadastrais(id, data)
        : tenantsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['tenants'] })
      toast.success('Atualizado!')
      onClose()
    },
    onError: () => toast.error('Erro ao atualizar'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (cnpjError) {
      toast.error('Corrija o CNPJ antes de salvar')
      return
    }

    const budget = form.budget_brl_diario.trim()
    const budgetParsed: number | null =
      budget === '' ? null : Number(budget.replace(',', '.'))
    if (budget !== '' && (Number.isNaN(budgetParsed) || (budgetParsed ?? 0) < 0)) {
      toast.error('Limite diário inválido')
      return
    }

    // Payload base — comum a create/update
    const basePayload: Partial<Tenant> = {
      nome: form.nome.trim(),
      cnpj: form.cnpj ? unmaskCNPJ(form.cnpj) : null,
      razao_social: form.razao_social.trim() || null,
      nicho: form.nicho.trim() || undefined,
      timezone: form.timezone,
      nome_agente: form.nome_agente.trim() || undefined,
      // Endereço
      endereco_cep: form.endereco_cep ? unmaskCEP(form.endereco_cep) : null,
      endereco_logradouro: form.endereco_logradouro.trim() || null,
      endereco_numero: form.endereco_numero.trim() || null,
      endereco_complemento: form.endereco_complemento.trim() || null,
      endereco_bairro: form.endereco_bairro.trim() || null,
      endereco_cidade: form.endereco_cidade.trim() || null,
      endereco_uf: form.endereco_uf || null,
      contatos: form.contatos.filter((c) => (c.telefone || '').trim() || (c.email || '').trim()),
      // Responsável
      responsavel_nome: form.responsavel_nome.trim() || null,
      responsavel_cargo: form.responsavel_cargo.trim() || null,
      responsavel_email: form.responsavel_email.trim() || null,
      responsavel_telefone: form.responsavel_telefone.trim() || null,
    }

    // Apenas superadmin (e na criação) pode mudar slug/plano/budget
    if (!restrictedMode && isSuperadmin) {
      Object.assign(basePayload, {
        plano: form.plano,
        budget_brl_diario: budgetParsed,
      })
      if (isCreating) {
        Object.assign(basePayload, { slug: form.slug.trim() })
      }
    }

    if (isCreating) {
      createMutation.mutate(basePayload as Parameters<typeof createMutation.mutate>[0])
    } else {
      updateMutation.mutate({ id: tenant!.id, data: basePayload })
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending

  // Contatos helpers
  function addContato() {
    setForm((f) => ({
      ...f,
      contatos: [...f.contatos, { tipo: 'comercial', telefone: '', email: '' }],
    }))
  }
  function updateContato(idx: number, patch: Partial<ContatoEmpresa>) {
    setForm((f) => ({
      ...f,
      contatos: f.contatos.map((c, i) => (i === idx ? { ...c, ...patch } : c)),
    }))
  }
  function removeContato(idx: number) {
    setForm((f) => ({ ...f, contatos: f.contatos.filter((_, i) => i !== idx) }))
  }

  const fotoSrc = resolveAvatarUrl(avatarUrl)

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
    >
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-[520px] h-full flex flex-col"
        style={{ background: 'var(--bg-surface)', borderLeft: '1px solid var(--border)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-3">
            {/* Avatar/Logo */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden flex-shrink-0"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
            >
              {fotoSrc ? (
                <img src={fotoSrc} alt="" className="w-full h-full object-cover" />
              ) : (
                <Building2 size={20} style={{ color: 'var(--text-3)' }} />
              )}
            </div>
            <div>
              <p className="text-base font-semibold" style={{ color: 'var(--text-1)' }}>
                {isCreating ? 'Nova empresa' : tenant!.nome}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-3)' }}>
                {isCreating ? 'Cadastre os dados básicos' : 'Editar dados cadastrais'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-3)' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={16} />
          </button>
        </div>

        {/* Logo upload — só quando editando (precisa de id) */}
        {!isCreating && (
          <div
            className="flex items-center gap-3 px-5 py-3"
            style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)' }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleFilePick}
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadAvatarMutation.isPending}
              className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg transition-all disabled:opacity-50"
              style={{
                background: 'var(--bg-card)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-1)',
              }}
            >
              {uploadAvatarMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
              {fotoSrc ? 'Trocar logo' : 'Enviar logo'}
            </button>
            {fotoSrc && (
              <button
                type="button"
                onClick={() => deleteAvatarMutation.mutate(tenant!.id)}
                disabled={deleteAvatarMutation.isPending}
                className="text-xs flex items-center gap-1 transition-colors"
                style={{ color: 'var(--text-3)' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
              >
                <Trash2 size={11} />
                Remover
              </button>
            )}
            <span className="text-[10px] ml-auto" style={{ color: 'var(--text-3)' }}>JPG/PNG/WEBP, máx 5MB</span>
          </div>
        )}

        {/* Body — seções colapsáveis */}
        <div className="flex-1 overflow-y-auto">
          {/* 1. Identificação */}
          <Section
            title="Identificação"
            icon={Building2}
            isOpen={openSections.identificacao}
            onToggle={() => toggleSection('identificacao')}
          >
            <Field label="Nome fantasia" required>
              <input
                type="text"
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                required
                style={inputStyle}
              />
            </Field>
            <Field label="Razão social">
              <input
                type="text"
                value={form.razao_social}
                onChange={(e) => setForm({ ...form, razao_social: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="CNPJ" hint="Opcional. Se preenchido, valida formato." error={cnpjError}>
              <input
                type="text"
                value={form.cnpj}
                onChange={(e) => setForm({ ...form, cnpj: formatCNPJ(e.target.value) })}
                placeholder="00.000.000/0000-00"
                style={inputStyle}
              />
            </Field>
            {/* Slug + plano só pra superadmin (e na criação pra slug) */}
            {!restrictedMode && isSuperadmin && (
              <>
                {isCreating && (
                  <Field label="Slug" required hint="URL única, sem espaços">
                    <input
                      type="text"
                      value={form.slug}
                      onChange={(e) => setForm({ ...form, slug: e.target.value })}
                      required
                      style={inputStyle}
                    />
                  </Field>
                )}
                <Field label="Plano">
                  <select
                    value={form.plano}
                    onChange={(e) => setForm({ ...form, plano: e.target.value })}
                    style={inputStyle}
                  >
                    {PLANOS.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Nicho">
              <input
                type="text"
                value={form.nicho}
                onChange={(e) => setForm({ ...form, nicho: e.target.value })}
                placeholder="ex: franquias, automotivo"
                style={inputStyle}
              />
            </Field>
          </Section>

          {/* 2. Endereço */}
          <Section
            title="Endereço"
            icon={MapPin}
            isOpen={openSections.endereco}
            onToggle={() => toggleSection('endereco')}
          >
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-1">
                <Field label="CEP" hint={cepLoading ? 'Buscando...' : undefined}>
                  <input
                    type="text"
                    value={form.endereco_cep}
                    onChange={(e) => handleCEPChange(e.target.value)}
                    placeholder="00000-000"
                    style={inputStyle}
                  />
                </Field>
              </div>
              <div className="col-span-2 flex items-end" style={{ paddingBottom: 2 }}>
                <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>
                  Digite o CEP — preenche o resto automaticamente
                </span>
              </div>
            </div>
            <Field label="Logradouro">
              <input
                type="text"
                value={form.endereco_logradouro}
                onChange={(e) => setForm({ ...form, endereco_logradouro: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <div className="grid grid-cols-3 gap-3">
              <Field label="Número">
                <input
                  type="text"
                  value={form.endereco_numero}
                  onChange={(e) => setForm({ ...form, endereco_numero: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <div className="col-span-2">
                <Field label="Complemento">
                  <input
                    type="text"
                    value={form.endereco_complemento}
                    onChange={(e) => setForm({ ...form, endereco_complemento: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>
            </div>
            <Field label="Bairro">
              <input
                type="text"
                value={form.endereco_bairro}
                onChange={(e) => setForm({ ...form, endereco_bairro: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-3">
                <Field label="Cidade">
                  <input
                    type="text"
                    value={form.endereco_cidade}
                    onChange={(e) => setForm({ ...form, endereco_cidade: e.target.value })}
                    style={inputStyle}
                  />
                </Field>
              </div>
              <Field label="UF">
                <select
                  value={form.endereco_uf}
                  onChange={(e) => setForm({ ...form, endereco_uf: e.target.value })}
                  style={inputStyle}
                >
                  <option value="">—</option>
                  {UFs.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* 3. Contatos */}
          <Section
            title={`Contatos${form.contatos.length > 0 ? ` · ${form.contatos.length}` : ''}`}
            icon={Phone}
            isOpen={openSections.contatos}
            onToggle={() => toggleSection('contatos')}
          >
            {form.contatos.length === 0 && (
              <p className="text-xs italic" style={{ color: 'var(--text-3)' }}>
                Nenhum contato cadastrado.
              </p>
            )}
            {form.contatos.map((c, idx) => (
              <div
                key={idx}
                className="rounded-lg p-3 space-y-2"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
              >
                <div className="flex items-center justify-between">
                  <select
                    value={c.tipo}
                    onChange={(e) => updateContato(idx, { tipo: e.target.value as ContatoEmpresa['tipo'] })}
                    style={{ ...inputStyle, width: 'auto', padding: '4px 8px', fontSize: 12 }}
                  >
                    <option value="comercial">Comercial</option>
                    <option value="financeiro">Financeiro</option>
                    <option value="suporte">Suporte</option>
                    <option value="outro">Outro</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeContato(idx)}
                    className="p-1 rounded transition-colors"
                    style={{ color: 'var(--text-3)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = '#f87171')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-3)')}
                    aria-label="Remover contato"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
                <input
                  type="tel"
                  value={c.telefone ?? ''}
                  onChange={(e) => updateContato(idx, { telefone: e.target.value })}
                  placeholder="Telefone"
                  style={inputStyle}
                />
                <input
                  type="email"
                  value={c.email ?? ''}
                  onChange={(e) => updateContato(idx, { email: e.target.value })}
                  placeholder="Email"
                  style={inputStyle}
                />
              </div>
            ))}
            <button
              type="button"
              onClick={addContato}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg transition-colors"
              style={{
                background: 'transparent',
                border: '1px dashed var(--border)',
                color: 'var(--text-2)',
              }}
            >
              <Plus size={12} />
              Adicionar contato
            </button>
          </Section>

          {/* 4. Responsável */}
          <Section
            title="Responsável"
            icon={UserIcon}
            isOpen={openSections.responsavel}
            onToggle={() => toggleSection('responsavel')}
          >
            <div className="grid grid-cols-2 gap-3">
              <Field label="Nome">
                <input
                  type="text"
                  value={form.responsavel_nome}
                  onChange={(e) => setForm({ ...form, responsavel_nome: e.target.value })}
                  style={inputStyle}
                />
              </Field>
              <Field label="Cargo">
                <input
                  type="text"
                  value={form.responsavel_cargo}
                  onChange={(e) => setForm({ ...form, responsavel_cargo: e.target.value })}
                  style={inputStyle}
                />
              </Field>
            </div>
            <Field label="Email">
              <input
                type="email"
                value={form.responsavel_email}
                onChange={(e) => setForm({ ...form, responsavel_email: e.target.value })}
                style={inputStyle}
              />
            </Field>
            <Field label="Telefone">
              <input
                type="tel"
                value={form.responsavel_telefone}
                onChange={(e) => setForm({ ...form, responsavel_telefone: e.target.value })}
                style={inputStyle}
              />
            </Field>
          </Section>

          {/* 5. Configurações */}
          <Section
            title="Configurações"
            icon={Settings}
            isOpen={openSections.config}
            onToggle={() => toggleSection('config')}
          >
            <Field label="Timezone">
              <select
                value={form.timezone}
                onChange={(e) => setForm({ ...form, timezone: e.target.value })}
                style={inputStyle}
              >
                {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </Field>
            <Field label="Nome do agente IA" hint="Como a IA se identifica nas conversas (ex.: 'Maria', 'Atendente virtual')">
              <input
                type="text"
                value={form.nome_agente}
                onChange={(e) => setForm({ ...form, nome_agente: e.target.value })}
                style={inputStyle}
              />
            </Field>
            {!restrictedMode && isSuperadmin && (
              <Field label="Limite diário LLM (R$)" hint="Apenas alerta visual — não bloqueia. Vazio = sem limite.">
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.budget_brl_diario}
                  onChange={(e) => setForm({ ...form, budget_brl_diario: e.target.value })}
                  placeholder="ex: 50,00"
                  style={inputStyle}
                />
              </Field>
            )}
            {restrictedMode && (
              <div
                className="flex items-start gap-2 p-2 rounded-lg text-xs"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', color: '#fbbf24' }}
              >
                <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                <span>Plano, slug e limite diário só podem ser alterados pela equipe administradora.</span>
              </div>
            )}
          </Section>
        </div>

        {/* Footer — actions */}
        <div
          className="flex items-center justify-between gap-3 px-5 py-3 flex-shrink-0"
          style={{ borderTop: '1px solid var(--border)' }}
        >
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-3 py-1.5 rounded-lg transition-colors"
            style={{ background: 'transparent', color: 'var(--text-2)' }}
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="flex items-center gap-2 text-xs font-medium px-4 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: 'var(--brand-500)', color: '#fff' }}
          >
            {isPending && <Loader2 size={12} className="animate-spin" />}
            {isCreating ? 'Criar empresa' : 'Salvar alterações'}
          </button>
        </div>
      </form>
    </div>,
    document.body
  )
}
