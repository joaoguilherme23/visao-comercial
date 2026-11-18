import { useQuery } from '@tanstack/react-query'
import { getLeadMensagens, MensagemItem } from '../../../api/dashboard'
import { MessageSkeleton } from '../../ui/skeletons'

export default function MensagensLead({ clienteId, leadId }: { clienteId: string; leadId: string }) {
  const { data: msgs, isLoading } = useQuery({
    queryKey: ['lead-msgs', leadId],
    queryFn: () => getLeadMensagens(clienteId, leadId),
    staleTime: 60_000,
  })

  if (isLoading) return <MessageSkeleton count={4} />

  const lista = msgs ?? []
  if (lista.length === 0) return (
    <p className="text-xs text-gray-600 px-3 py-2">Sem mensagens registradas</p>
  )

  return (
    <div className="px-3 py-2 space-y-1.5 max-h-64 overflow-y-auto">
      {lista.map((m: MensagemItem) => {
        const isOut = m.direcao === 'saida'
        return (
          <div
            key={m.id}
            className={`flex ${isOut ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[80%] rounded-lg px-3 py-1.5 text-xs"
              style={
                isOut
                  ? { background: '#3b5bdb', color: '#ffffff' }
                  : { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-1)' }
              }
            >
              {m.conteudo ?? <span className="italic opacity-60">[mídia]</span>}
              <div className="text-[10px] mt-0.5 opacity-50">
                {new Date(m.enviada_em).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
