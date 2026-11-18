import { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'

interface ProximoPassoCardProps {
  texto: string
}

/**
 * Card destacado exibido no topo do ChatPanel em Modo Atendimento, com a
 * sugestão "Próximo passo" gerada pela IA (vem de `LeadDetalhe.analise.proximo_passo`).
 *
 * A aplicação é somente leitura — não envia mensagens. Então o card tem um botão Copiar que
 * coloca o texto na área de transferência para o operador colar no WhatsApp.
 *
 * Usa `navigator.clipboard.writeText` quando disponível; cai num fallback via
 * `document.execCommand('copy')` em browsers/contextos mais antigos.
 */
export function ProximoPassoCard({ texto }: ProximoPassoCardProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(texto)
      } else {
        // Fallback para contextos sem clipboard API (http, iframes, etc).
        const ta = document.createElement('textarea')
        ta.value = texto
        ta.style.position = 'fixed'
        ta.style.opacity = '0'
        document.body.appendChild(ta)
        ta.select()
        document.execCommand('copy')
        document.body.removeChild(ta)
      }
      setCopied(true)
      toast.success('Copiado! Agora cola no WhatsApp.')
      setTimeout(() => setCopied(false), 1500)
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie manualmente.')
    }
  }

  return (
    <div
      className="mx-4 my-3 rounded-xl p-4"
      style={{
        background: 'rgba(168,85,247,0.08)',
        border: '1px solid rgba(168,85,247,0.3)',
      }}
    >
      <div
        className="text-[10px] uppercase font-semibold tracking-wider mb-2"
        style={{ color: '#58e2d8' }}
      >
        ✦ Próximo passo
      </div>
      <div
        className="text-sm leading-relaxed mb-3"
        style={{ color: 'var(--text-1)' }}
      >
        {texto}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>
          Sugestão da IA · copie e cole no WhatsApp
        </span>
        <button
          onClick={handleCopy}
          aria-label="Copiar próximo passo sugerido"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
          style={{
            background: 'rgba(168,85,247,0.15)',
            color: '#58e2d8',
            border: '1px solid rgba(168,85,247,0.3)',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(168,85,247,0.25)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(168,85,247,0.15)')}
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  )
}
