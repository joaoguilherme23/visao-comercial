import { EmptyState } from '../ds'

/**
 * Estado vazio global: nenhum bucket tem itens.
 * Wrapper thin sobre <EmptyState variant="success" size="lg" /> com CTA pro Kanban.
 */
export function AgoraEmpty() {
  return (
    <EmptyState
      variant="success"
      size="lg"
      title="Fila limpa."
      description="Nenhum lead precisa da sua atenção agora. Bora pro Kanban?"
      action={{ label: 'Ir para o Kanban →', href: '/kanban' }}
    />
  )
}
