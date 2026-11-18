import { useState } from 'react'
import {
  Flame, Snowflake, Crown, Shield, Eye, TrendingUp, TrendingDown, Minus,
  CheckCircle2, Info, Inbox, AlertCircle, Filter, Calendar, Settings2,
} from 'lucide-react'
import { Pill, EmptyState, ConfirmModal, Popover } from '../../components/ds'
import { semanticColors } from '../../lib/semanticColors'

/**
 * Preview do Design System — uso interno (/dev/ds).
 * Protegida por RequireSuperAdmin em App.tsx.
 */
export default function DesignSystemPage() {
  const [confirmDanger, setConfirmDanger] = useState(false)
  const [confirmWarning, setConfirmWarning] = useState(false)
  const [confirmInfo, setConfirmInfo] = useState(false)
  const [loadingConfirm, setLoadingConfirm] = useState(false)

  const handleConfirmWithLoading = async () => {
    setLoadingConfirm(true)
    await new Promise((r) => setTimeout(r, 1500))
    setLoadingConfirm(false)
    setConfirmDanger(false)
  }

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10" style={{ color: 'var(--text-1)' }}>
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold mb-1">Design System — Preview</h1>
          <p className="text-sm" style={{ color: 'var(--text-3)' }}>
            Catálogo visual dos primitivos do DS. Uso interno ({'/'}dev{'/'}ds).
          </p>
        </div>
        <Pill tone="role:admin" variant="soft" icon={Crown}>
          Super Admin
        </Pill>
      </header>

      {/* ── Pills ─────────────────────────────────────────────────────────────── */}
      <Section title="Pill — pílulas semânticas">
        <Subsection title="Temperatura">
          <Row>
            <Pill tone="temperatura:quente" dot>Quente</Pill>
            <Pill tone="temperatura:morno" dot>Morno</Pill>
            <Pill tone="temperatura:frio" dot>Frio</Pill>
            <Pill tone="temperatura:quente" icon={Flame}>Quente</Pill>
            <Pill tone="temperatura:frio" icon={Snowflake}>Frio</Pill>
          </Row>
        </Subsection>

        <Subsection title="Sentimento">
          <Row>
            <Pill tone="sentimento:positivo" dot>Positivo</Pill>
            <Pill tone="sentimento:neutro" dot>Neutro</Pill>
            <Pill tone="sentimento:negativo" dot>Negativo</Pill>
          </Row>
        </Subsection>

        <Subsection title="Variação">
          <Row>
            <Pill tone="variacao:up" icon={TrendingUp} mono>+12,5%</Pill>
            <Pill tone="variacao:down" icon={TrendingDown} mono>-7,3%</Pill>
            <Pill tone="variacao:flat" icon={Minus} mono>0,2%</Pill>
          </Row>
        </Subsection>

        <Subsection title="Status">
          <Row>
            <Pill tone="status:active">Ativo</Pill>
            <Pill tone="status:inactive">Inativo</Pill>
            <Pill tone="status:pending">Pendente</Pill>
            <Pill tone="status:danger" icon={AlertCircle}>Erro</Pill>
            <Pill tone="status:success" icon={CheckCircle2}>OK</Pill>
          </Row>
        </Subsection>

        <Subsection title="Role">
          <Row>
            <Pill tone="role:admin" icon={Crown}>Admin</Pill>
            <Pill tone="role:manager" icon={Shield}>Gestor</Pill>
            <Pill tone="role:viewer" icon={Eye}>Visualizador</Pill>
          </Row>
        </Subsection>

        <Subsection title="Neutral">
          <Row>
            <Pill tone="neutral">Motos</Pill>
            <Pill tone="neutral" variant="ghost">Ghost</Pill>
            <Pill tone="neutral" variant="solid">Solid</Pill>
          </Row>
        </Subsection>

        <Subsection title="Variants (tone quente)">
          <Row>
            <Pill tone="temperatura:quente" variant="soft">soft</Pill>
            <Pill tone="temperatura:quente" variant="solid">solid</Pill>
            <Pill tone="temperatura:quente" variant="ghost">ghost</Pill>
          </Row>
        </Subsection>

        <Subsection title="Tamanhos">
          <Row>
            <Pill tone="temperatura:quente" size="xs" dot>XS</Pill>
            <Pill tone="temperatura:quente" size="sm" dot>SM</Pill>
            <Pill tone="temperatura:quente" size="md" dot>MD</Pill>
          </Row>
        </Subsection>

        <Subsection title="Casos reais">
          <Row>
            <Pill tone="temperatura:quente" size="xs" icon={Flame}>Quente</Pill>
            <Pill tone="variacao:up" size="xs" mono>score 8.5</Pill>
            <Pill tone="status:pending" size="xs" className="animate-pulse-soft">NEW</Pill>
            <Pill tone="role:manager" size="xs">Gestor</Pill>
            <Pill tone="neutral" size="xs">Alifilho Motos</Pill>
          </Row>
        </Subsection>
      </Section>

      {/* ── EmptyState ────────────────────────────────────────────────────────── */}
      <Section title="EmptyState — estados vazios">
        <Subsection title="4 variantes (size md)">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <EmptyState
                variant="success"
                title="Fila limpa."
                description="Nenhum lead precisa da sua atenção agora."
              />
            </Card>
            <Card>
              <EmptyState
                variant="info"
                title="Selecione um tenant"
                description="Escolha um cliente no seletor acima para visualizar os dados."
              />
            </Card>
            <Card>
              <EmptyState
                variant="empty"
                title="Nenhum lead por aqui"
                description="Ajuste os filtros ou tente outro período."
              />
            </Card>
            <Card>
              <EmptyState
                variant="error"
                title="Erro ao carregar"
                description="Não foi possível buscar os dados. Tente novamente."
                action={{ label: 'Tentar de novo', variant: 'primary' }}
              />
            </Card>
          </div>
        </Subsection>

        <Subsection title="Tamanhos (variant success)">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <EmptyState variant="success" size="sm" title="Tudo ok" description="sm" />
            </Card>
            <Card>
              <EmptyState variant="success" size="md" title="Fila limpa" description="md" />
            </Card>
            <Card>
              <EmptyState variant="success" size="lg" title="Nada pendente" description="lg com halo" />
            </Card>
          </div>
        </Subsection>

        <Subsection title="Com ação">
          <Card>
            <EmptyState
              variant="empty"
              icon={Inbox}
              title="Nenhuma notificação"
              description="Você está em dia. Novas notificações aparecerão aqui."
              action={{ label: 'Configurar notificações', variant: 'secondary', href: '/settings' }}
              size="md"
            />
          </Card>
        </Subsection>
      </Section>

      {/* ── ConfirmModal ──────────────────────────────────────────────────────── */}
      <Section title="ConfirmModal — diálogos de confirmação">
        <Subsection title="3 variantes">
          <Row>
            <Btn onClick={() => setConfirmDanger(true)} color="#ef4444">
              Abrir Danger
            </Btn>
            <Btn onClick={() => setConfirmWarning(true)} color="#facc15">
              Abrir Warning
            </Btn>
            <Btn onClick={() => setConfirmInfo(true)} color="#818cf8">
              Abrir Info
            </Btn>
          </Row>
        </Subsection>
        <p className="text-xs" style={{ color: 'var(--text-3)' }}>
          Acessibilidade: ESC fecha, clique no overlay fecha, Cancel recebe foco automático.
          Estado loading desabilita interação (clique em Danger para testar o fluxo de loading).
        </p>
      </Section>

      {/* ── Popover ───────────────────────────────────────────────────────────── */}
      <Section title="Popover — conteúdo flutuante">
        <Subsection title="Side/Align">
          <Row>
            <Popover
              side="bottom" align="start"
              trigger={
                <Btn color="var(--brand-500)">
                  <Filter size={14} /> bottom-start
                </Btn>
              }
            >
              <div className="p-4 text-sm w-56">
                <p className="font-semibold mb-1">Filtros</p>
                <p style={{ color: 'var(--text-3)' }}>bottom-start, width 224px</p>
              </div>
            </Popover>

            <Popover
              side="bottom" align="end"
              trigger={
                <Btn color="var(--brand-500)">
                  <Calendar size={14} /> bottom-end
                </Btn>
              }
            >
              <div className="p-4 text-sm w-56">
                <p className="font-semibold mb-1">Período</p>
                <p style={{ color: 'var(--text-3)' }}>bottom-end</p>
              </div>
            </Popover>

            <Popover
              side="top" align="center"
              trigger={
                <Btn color="var(--brand-500)">
                  <Info size={14} /> top-center
                </Btn>
              }
            >
              <div className="p-4 text-sm w-56">
                <p className="font-semibold mb-1">Dica</p>
                <p style={{ color: 'var(--text-3)' }}>top-center</p>
              </div>
            </Popover>

            <Popover
              side="right" align="start"
              trigger={
                <Btn color="var(--brand-500)">
                  <Settings2 size={14} /> right-start
                </Btn>
              }
            >
              <div className="p-4 text-sm w-56">
                <p className="font-semibold mb-1">Configurações</p>
                <p style={{ color: 'var(--text-3)' }}>right-start</p>
              </div>
            </Popover>
          </Row>
        </Subsection>
      </Section>

      {/* ── Tokens ────────────────────────────────────────────────────────────── */}
      <Section title="Tokens — paleta semântica">
        <Subsection title="Temperatura">
          <Row>
            <Swatch color={semanticColors.temperatura.quente} label="quente #ef4444" />
            <Swatch color={semanticColors.temperatura.morno} label="morno #f97316" />
            <Swatch color={semanticColors.temperatura.frio} label="frio #3b82f6" />
          </Row>
        </Subsection>
        <Subsection title="Sentimento">
          <Row>
            <Swatch color={semanticColors.sentimento.positivo} label="positivo #22c55e" />
            <Swatch color={semanticColors.sentimento.neutro} label="neutro #94a3b8" />
            <Swatch color={semanticColors.sentimento.negativo} label="negativo #ef4444" />
          </Row>
        </Subsection>
        <Subsection title="Variação">
          <Row>
            <Swatch color={semanticColors.variacao.up} label="up #4ade80" />
            <Swatch color={semanticColors.variacao.down} label="down #f87171" />
            <Swatch color={semanticColors.variacao.flat} label="flat #94a3b8" />
          </Row>
        </Subsection>
      </Section>

      {/* Modais */}
      <ConfirmModal
        open={confirmDanger}
        onClose={() => setConfirmDanger(false)}
        onConfirm={handleConfirmWithLoading}
        variant="danger"
        isLoading={loadingConfirm}
        title="Excluir lead Alifilho Motos?"
        description="Esta ação removerá o lead de todas as listas."
        bullets={[
          'Todas as conversas relacionadas ficarão órfãs',
          'O histórico de transições do Kanban é perdido',
          'Relatórios históricos podem ser impactados',
        ]}
        confirmLabel="Excluir definitivo"
      />
      <ConfirmModal
        open={confirmWarning}
        onClose={() => setConfirmWarning(false)}
        onConfirm={() => setConfirmWarning(false)}
        variant="warning"
        title="Desativar integração?"
        description="A conexão vai parar de receber eventos até ser reativada."
        confirmLabel="Desativar"
      />
      <ConfirmModal
        open={confirmInfo}
        onClose={() => setConfirmInfo(false)}
        onConfirm={() => setConfirmInfo(false)}
        variant="info"
        title="Enviar relatório por e-mail?"
        description="O relatório será encaminhado para os gestores cadastrados."
        confirmLabel="Enviar"
      />
    </div>
  )
}

// ── Helpers visuais ───────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold border-b pb-2" style={{ borderColor: 'var(--border)' }}>
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  )
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-3)' }}>
        {title}
      </p>
      {children}
    </div>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2">{children}</div>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
      {children}
    </div>
  )
}

function Btn({
  children,
  onClick,
  color,
}: {
  children: React.ReactNode
  onClick?: () => void
  color: string
}) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-2 h-8 px-3 rounded-lg text-sm font-medium text-white transition-opacity hover:opacity-90"
      style={{ background: color }}
    >
      {children}
    </button>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="w-10 h-10 rounded-lg" style={{ background: color, border: '1px solid var(--border)' }} />
      <div className="text-xs font-mono-data" style={{ color: 'var(--text-2)' }}>{label}</div>
    </div>
  )
}
