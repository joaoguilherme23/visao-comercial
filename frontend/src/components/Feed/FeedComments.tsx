import { useState, KeyboardEvent } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { Send, Loader2 } from 'lucide-react'

import { feedApi } from '../../api/feed'
import type { ComentarioLead } from '../../types'
import { toastError } from '../../lib/toast'

interface Props {
  clienteId: string
  leadId: string
}

function relativeTime(iso: string): string {
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: ptBR })
  } catch {
    return ''
  }
}

export default function FeedComments({ clienteId, leadId }: Props) {
  const qc = useQueryClient()
  const [texto, setTexto] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['feed-comentarios', clienteId, leadId],
    queryFn: () => feedApi.listComentarios(clienteId, leadId),
    enabled: !!clienteId && !!leadId,
    staleTime: 10_000,
  })

  const createMutation = useMutation({
    mutationFn: (txt: string) => feedApi.createComentario(clienteId, leadId, txt),
    onSuccess: (novo: ComentarioLead) => {
      // Atualiza cache local sem refetch
      qc.setQueryData<ComentarioLead[]>(
        ['feed-comentarios', clienteId, leadId],
        (old) => (old ? [novo, ...old] : [novo])
      )
      // Invalida o feed pra atualizar o contador no card
      qc.invalidateQueries({ queryKey: ['feed', clienteId] })
      setTexto('')
    },
    onError: (err) => {
      toastError(err, { fallback: 'Erro ao enviar comentário' })
    },
  })

  function submit() {
    const t = texto.trim()
    if (!t || createMutation.isPending) return
    createMutation.mutate(t)
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter envia, Shift+Enter quebra linha
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  return (
    <div className="space-y-3">
      {/* Input de novo comentário */}
      <div
        className="flex items-end gap-2 p-2 rounded-lg"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      >
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Comentário interno do time…"
          className="flex-1 bg-transparent text-sm resize-none outline-none px-2 py-1.5 placeholder-gray-500"
          style={{ color: 'var(--text-1)' }}
          maxLength={2000}
        />
        <button
          onClick={submit}
          disabled={!texto.trim() || createMutation.isPending}
          className="flex-shrink-0 p-2 rounded-md transition-colors disabled:opacity-40"
          style={{
            background: 'rgba(11,150,146,0.12)',
            color: '#25c8bd',
            border: '1px solid rgba(11,150,146,0.3)',
          }}
          title="Enviar (Enter)"
        >
          {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
        </button>
      </div>

      {/* Lista de comentários */}
      {isLoading ? (
        <div className="text-xs flex items-center gap-2" style={{ color: 'var(--text-3)' }}>
          <Loader2 size={12} className="animate-spin" />
          Carregando comentários…
        </div>
      ) : !data || data.length === 0 ? (
        <p className="text-xs italic" style={{ color: 'var(--text-3)' }}>
          Nenhum comentário ainda. Seja o primeiro a registrar uma observação interna.
        </p>
      ) : (
        <ul className="space-y-2">
          {data.map((c) => (
            <li
              key={c.id}
              className="rounded-lg px-3 py-2 text-sm"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-1)',
              }}
            >
              <div className="flex items-center justify-between text-xs mb-1" style={{ color: 'var(--text-3)' }}>
                <span className="font-medium" style={{ color: 'var(--text-2)' }}>
                  {c.autor_nome}
                </span>
                <span>{relativeTime(c.created_at)}</span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{c.texto}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
