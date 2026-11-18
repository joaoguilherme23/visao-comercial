import { brandColor } from '../../lib/brandColor'
import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { X, Info } from 'lucide-react'
import toast from 'react-hot-toast'
import {
  createWidget,
  updateWidget,
  WIDGET_COMPAT,
  type AnaliseWidgetOut,
  type AnaliseWidgetCreate,
} from '../../api/dashboard'

interface CampoDisponivel {
  nome: string
  label: string
  tipo: string
}

interface Props {
  clienteId: string
  camposDisponiveis: CampoDisponivel[]
  widget?: AnaliseWidgetOut
  onSave: (widget: AnaliseWidgetOut) => void
  onClose: () => void
}

const OPERACOES = [
  { value: 'top_n',   label: 'Top N mais frequentes' },
  { value: 'count',   label: 'Contagem' },
  { value: 'avg',     label: 'Média' },
  { value: 'sum',     label: 'Soma' },
  { value: 'min',     label: 'Mínimo' },
  { value: 'max',     label: 'Máximo' },
  { value: 'percent', label: 'Percentual' },
]

const GRAFICOS = [
  { value: 'bar',     label: 'Barra' },
  { value: 'column',  label: 'Coluna' },
  { value: 'pie',     label: 'Pizza' },
  { value: 'donut',   label: 'Donut' },
  { value: 'line',    label: 'Linha' },
  { value: 'area',    label: 'Área' },
  { value: 'treemap', label: 'Treemap' },
  { value: 'funnel',  label: 'Funil' },
  { value: 'metric',  label: 'Métrica' },
  { value: 'table',   label: 'Tabela' },
]

export default function WidgetBuilder({ clienteId, camposDisponiveis, widget, onSave, onClose }: Props) {
  const isEdit = !!widget

  const [label, setLabel] = useState(widget?.label ?? '')
  const [descricao, setDescricao] = useState(widget?.descricao ?? '')
  const [campo, setCampo] = useState(widget?.campo ?? (camposDisponiveis[0]?.nome ?? ''))
  const [operacao, setOperacao] = useState(widget?.operacao ?? 'top_n')
  const [tipoGrafico, setTipoGrafico] = useState(widget?.tipo_grafico ?? 'bar')
  const [limite, setLimite] = useState(widget?.limite ?? 10)
  const [cor, setCor] = useState(brandColor(widget?.cor))
  const [semConversao, setSemConversao] = useState(widget?.somente_sem_conversao ?? false)

  const compativeis = WIDGET_COMPAT[operacao] ?? []

  const handleOperacaoChange = (op: string) => {
    setOperacao(op)
    const compats = WIDGET_COMPAT[op] ?? []
    if (!compats.includes(tipoGrafico)) {
      setTipoGrafico(compats[0] ?? 'bar')
    }
  }

  const mutation = useMutation({
    mutationFn: (body: AnaliseWidgetCreate) =>
      isEdit
        ? updateWidget(clienteId, widget!.id, body)
        : createWidget(clienteId, body),
    onSuccess: (saved) => {
      toast.success(isEdit ? 'Widget atualizado!' : 'Widget criado!')
      onSave(saved)
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Erro ao salvar'
      toast.error(msg)
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!label.trim() || !campo) return
    mutation.mutate({
      label,
      descricao: descricao || undefined,
      campo,
      operacao,
      tipo_grafico: tipoGrafico,
      limite,
      cor,
      somente_sem_conversao: semConversao,
    })
  }

  const inputCls = 'w-full rounded-lg px-3 py-2 text-sm text-white outline-none focus:ring-1 focus:ring-brand-500'
  const inputStyle = { background: 'var(--bg-elevated)', border: '1px solid var(--border)' }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div
        className="rounded-2xl w-full max-w-lg shadow-2xl flex flex-col"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h2 className="text-base font-semibold text-white">
            {isEdit ? 'Editar Widget' : 'Novo Widget de Análise'}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-500 hover:text-white hover:bg-gray-800 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto max-h-[75vh]">
          {/* Nome */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Nome *</label>
            <input
              required
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="Ex: Principais Objeções"
            />
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Descrição (opcional)</label>
            <input
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className={inputCls}
              style={inputStyle}
              placeholder="Texto de ajuda exibido no tooltip"
            />
          </div>

          {/* Campo */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-xs font-medium text-gray-400">Campo *</label>
              <span title="Campos extraídos automaticamente pela IA das conversas WhatsApp">
                <Info size={11} className="text-gray-600" />
              </span>
            </div>
            {camposDisponiveis.length > 0 ? (
              <select
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                className={inputCls}
                style={inputStyle}
              >
                {camposDisponiveis.map((c) => (
                  <option key={c.nome} value={c.nome}>{c.label} ({c.nome})</option>
                ))}
              </select>
            ) : (
              <input
                value={campo}
                onChange={(e) => setCampo(e.target.value)}
                className={inputCls}
                style={inputStyle}
                placeholder="nome_do_campo"
              />
            )}
          </div>

          {/* Operação */}
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <label className="text-xs font-medium text-gray-400">Operação *</label>
              <span title="Top N: mostra os N valores mais frequentes. Avg: calcula a média numérica.">
                <Info size={11} className="text-gray-600" />
              </span>
            </div>
            <select
              value={operacao}
              onChange={(e) => handleOperacaoChange(e.target.value)}
              className={inputCls}
              style={inputStyle}
            >
              {OPERACOES.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          {/* Tipo de Gráfico */}
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-2">Tipo de Gráfico *</label>
            <div className="grid grid-cols-4 gap-2">
              {GRAFICOS.map((g) => {
                const compat = compativeis.includes(g.value)
                return (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => compat && setTipoGrafico(g.value)}
                    disabled={!compat}
                    className={[
                      'rounded-lg py-2 px-1 text-xs font-medium border transition-all',
                      tipoGrafico === g.value
                        ? 'border-brand-500 text-white'
                        : compat
                        ? 'text-gray-400 hover:border-gray-600 hover:text-gray-300'
                        : 'opacity-30 cursor-not-allowed text-gray-600',
                    ].join(' ')}
                    style={
                      tipoGrafico === g.value
                        ? { background: 'rgba(11,150,146,0.15)', borderColor: '#0b9692' }
                        : { background: 'var(--bg-elevated)', borderColor: 'var(--border)' }
                    }
                  >
                    {g.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Limite (só para top_n) */}
          {operacao === 'top_n' && (
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Limite (top N)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={limite}
                onChange={(e) => setLimite(Number(e.target.value))}
                className={inputCls}
                style={inputStyle}
              />
            </div>
          )}

          {/* Cor + toggle sem conversão */}
          <div className="flex items-center gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1">Cor primária</label>
              <input
                type="color"
                value={cor}
                onChange={(e) => setCor(e.target.value)}
                className="h-8 w-12 rounded cursor-pointer border-0"
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-4">
              <input
                type="checkbox"
                checked={semConversao}
                onChange={(e) => setSemConversao(e.target.checked)}
                className="rounded"
              />
              <span className="text-xs text-gray-400">Só leads sem conversão</span>
            </label>
          </div>

          {/* Botões */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="px-5 py-2 text-sm font-medium text-white rounded-lg transition-colors disabled:opacity-50"
              style={{ background: 'var(--brand-500)' }}
            >
              {mutation.isPending ? 'Salvando...' : isEdit ? 'Atualizar' : 'Criar Widget'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
