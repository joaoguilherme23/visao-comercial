import { useState, useEffect, useMemo, useRef } from 'react'
import {
  HelpCircle, LayoutDashboard, Kanban, MessageSquare, Brain, Workflow,
  Settings, Keyboard, Search, ChevronRight, Lightbulb, AlertTriangle,
  Zap, Target, ThermometerSun, BarChart3, Flame, Maximize2,
} from 'lucide-react'
import { Pill as DSPill, EmptyState } from '../components/ds'
import type { Tone } from '../components/ds'

// ──────────────────────────────────────────────────────────────────────────────
// Componentes auxiliares
// ──────────────────────────────────────────────────────────────────────────────

function SectionHeading({ id, icon: Icon, title, subtitle }: {
  id: string
  icon: React.ElementType
  title: string
  subtitle?: string
}) {
  return (
    <div id={id} className="scroll-mt-8 mb-4">
      <div className="flex items-center gap-3 mb-1">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
          style={{ background: 'var(--brand-glow)', border: '1px solid var(--border-subtle)' }}
        >
          <Icon size={18} style={{ color: '#25c8bd' }} />
        </div>
        <h2 className="text-2xl font-semibold" style={{ color: 'var(--text-1)' }}>{title}</h2>
      </div>
      {subtitle && (
        <p className="text-sm ml-12" style={{ color: 'var(--text-2)' }}>{subtitle}</p>
      )}
    </div>
  )
}

function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-xl p-5 mb-4 ${className}`}
      style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
    >
      {children}
    </div>
  )
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 rounded-lg p-3 my-3 text-sm"
      style={{
        background: 'rgba(34,197,94,0.08)',
        border: '1px solid rgba(34,197,94,0.2)',
        color: 'var(--text-1)',
      }}
    >
      <Lightbulb size={16} className="shrink-0 mt-0.5" style={{ color: '#4ade80' }} />
      <div>{children}</div>
    </div>
  )
}

function Alert({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="flex gap-3 rounded-lg p-3 my-3 text-sm"
      style={{
        background: 'rgba(250,204,21,0.08)',
        border: '1px solid rgba(250,204,21,0.25)',
        color: 'var(--text-1)',
      }}
    >
      <AlertTriangle size={16} className="shrink-0 mt-0.5" style={{ color: '#facc15' }} />
      <div>{children}</div>
    </div>
  )
}

/**
 * TempPill — wrapper fino sobre <DSPill> pra doc visual na /ajuda.
 * Mapeia cor hex usada antigamente para o tone semantico equivalente.
 */
const HEX_TO_TONE: Record<string, Tone> = {
  '#ef4444': 'temperatura:quente',
  '#f97316': 'temperatura:morno',
  '#3b82f6': 'temperatura:frio',
  '#22c55e': 'sentimento:positivo',
  '#94a3b8': 'sentimento:neutro',
  '#0e7490': 'neutral', // misto — sem token direto; neutral com cor generica
}
function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  const tone = HEX_TO_TONE[color] ?? 'neutral'
  return (
    <DSPill tone={tone} dot>
      {children}
    </DSPill>
  )
}

function KeyCap({ children }: { children: React.ReactNode }) {
  return (
    <kbd
      className="inline-block px-2 py-0.5 rounded text-xs font-mono"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border)',
        color: 'var(--text-1)',
        boxShadow: 'inset 0 -1px 0 var(--border)',
      }}
    >
      {children}
    </kbd>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Estrutura das seções (usada pra TOC e busca)
// ──────────────────────────────────────────────────────────────────────────────

type SectionMeta = { id: string; title: string; icon: React.ElementType; keywords: string }

const SECTIONS: SectionMeta[] = [
  { id: 'visao-geral', title: 'Visão geral', icon: Zap, keywords: 'filosofia arquitetura ia whatsapp crm o que é' },
  { id: 'agora', title: 'Fila Agora', icon: Flame, keywords: 'agora fila prioridade quente urgente tempo real notificação' },
  { id: 'dashboard', title: 'Dashboard', icon: LayoutDashboard, keywords: 'kpi métrica heatmap funil sparkline exportar png' },
  { id: 'kanban', title: 'Kanban de Leads', icon: Kanban, keywords: 'coluna etapa mover card pipeline' },
  { id: 'conversas', title: 'Conversas', icon: MessageSquare, keywords: 'chat paginação insights temperatura score lead whatsapp deep linking separador data' },
  { id: 'modo-foco', title: 'Modo Atendimento', icon: Maximize2, keywords: 'modo foco atendimento fullscreen tela cheia concentração distração' },
  { id: 'analise-ia', title: 'Análise IA', icon: Brain, keywords: 'temperatura score sentimento intenção próximo passo oportunidade' },
  { id: 'playbook', title: 'Playbook — uso diário', icon: Workflow, keywords: 'gestor consultor rotina 15 minutos quentes mornos agora foco' },
  { id: 'configuracoes', title: 'Configurações', icon: Settings, keywords: 'kpis personalizados conexões números tenant multi' },
  { id: 'atalhos-faq', title: 'FAQ & atalhos', icon: Keyboard, keywords: 'perguntas frequentes atalho teclado tema suporte esc copiar ia deep link' },
]

// ──────────────────────────────────────────────────────────────────────────────
// TOC lateral com scroll-spy
// ──────────────────────────────────────────────────────────────────────────────

function Toc({ activeId, onNavigate }: { activeId: string; onNavigate: (id: string) => void }) {
  return (
    <aside className="hidden lg:block sticky top-6 self-start w-56 shrink-0">
      <div
        className="rounded-xl p-3"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
      >
        <p
          className="text-[10px] uppercase tracking-widest px-2 pt-1 pb-2 font-mono"
          style={{ color: 'var(--text-3)' }}
        >
          Nesta página
        </p>
        <nav className="space-y-0.5">
          {SECTIONS.map(s => {
            const active = s.id === activeId
            const Icon = s.icon
            return (
              <button
                key={s.id}
                onClick={() => onNavigate(s.id)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left transition-colors"
                style={{
                  background: active ? 'var(--brand-glow)' : 'transparent',
                  color: active ? '#a5b4fc' : 'var(--text-2)',
                  borderLeft: active ? '2px solid var(--brand-500)' : '2px solid transparent',
                  paddingLeft: active ? 6 : 8,
                }}
                onMouseEnter={e => {
                  if (!active) e.currentTarget.style.background = 'var(--bg-elevated)'
                }}
                onMouseLeave={e => {
                  if (!active) e.currentTarget.style.background = 'transparent'
                }}
              >
                <Icon size={12} />
                <span className="truncate">{s.title}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}

// ──────────────────────────────────────────────────────────────────────────────
// Página
// ──────────────────────────────────────────────────────────────────────────────

export default function AjudaPage() {
  const [activeId, setActiveId] = useState<string>(SECTIONS[0].id)
  const [search, setSearch] = useState('')
  const observerRef = useRef<IntersectionObserver | null>(null)

  // Scroll spy via IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)
        if (visible[0]) setActiveId(visible[0].target.id)
      },
      {
        rootMargin: '-10% 0px -70% 0px',
        threshold: [0, 0.25, 0.5, 0.75, 1],
      }
    )
    SECTIONS.forEach(s => {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    })
    observerRef.current = observer
    return () => observer.disconnect()
  }, [])

  const handleNavigate = (id: string) => {
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setActiveId(id)
    }
  }

  const filteredSections = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return SECTIONS.map(s => s.id)
    return SECTIONS
      .filter(s => s.title.toLowerCase().includes(q) || s.keywords.includes(q))
      .map(s => s.id)
  }, [search])

  const shows = (id: string) => filteredSections.includes(id)

  return (
    <div className="max-w-7xl mx-auto">
      {/* Hero */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--brand-glow)', border: '1px solid var(--border-subtle)' }}
          >
            <HelpCircle size={22} style={{ color: '#25c8bd' }} />
          </div>
          <div>
            <h1 className="font-display text-3xl font-bold" style={{ color: 'var(--text-1)' }}>
              Central de Ajuda
            </h1>
            <p className="text-sm" style={{ color: 'var(--text-2)' }}>
              Aprenda, timtim por timtim, como cada parte da Visão Comercial pode ajudar na operação.
            </p>
          </div>
        </div>

        {/* Busca */}
        <div className="mt-5 relative max-w-md">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-3)' }}
          />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar — ex: score, temperatura, funil, kanban..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg outline-none transition-colors"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              color: 'var(--text-1)',
            }}
          />
        </div>
      </div>

      {/* Corpo: TOC + conteúdo */}
      <div className="flex gap-8">
        <Toc activeId={activeId} onNavigate={handleNavigate} />

        <div className="flex-1 min-w-0">
          {/* ─────────────────────── 1. VISÃO GERAL ─────────────────────── */}
          {shows('visao-geral') && (
            <section className="mb-12">
              <SectionHeading
                id="visao-geral"
                icon={Zap}
                title="Visão geral"
                subtitle="O que é a Visão Comercial e por que ela existe"
              />
              <Card>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--text-1)' }}>
                  A <strong>Visão Comercial</strong> é uma plataforma de vendas que combina <strong>conversas
                  reais de WhatsApp</strong> com <strong>inteligência artificial</strong> pra
                  transformar um volume gigante de atendimentos em <strong>decisões rápidas</strong>.
                  Em vez de você abrir 50 conversas pra entender o que está quente, o sistema já
                  faz isso pra você — classifica, prioriza e mostra onde agir.
                </p>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
                  Ele é <strong>multi-empresa</strong> — cada cliente vê só os dados das
                  suas próprias empresas — e tem três eixos principais:
                  <strong>Dashboard</strong> (métricas agregadas), <strong>Kanban</strong>
                  (funil visual de leads) e <strong>Conversas</strong> (chat + insights por lead).
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>
                  Em uma frase
                </h3>
                <p className="text-base" style={{ color: 'var(--text-1)' }}>
                  "Cada conversa vira dado, cada dado vira decisão, cada decisão vira venda."
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>
                  Como o dado flui
                </h3>
                <ol className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--brand-glow)', color: '#a5b4fc' }}>1</span>
                    <span>Lead manda mensagem no WhatsApp do cliente (consultor, bot, studio).</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--brand-glow)', color: '#a5b4fc' }}>2</span>
                    <span>A conversa é registrada e a IA analisa: tema, sentimento, intenção, próximo passo.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--brand-glow)', color: '#a5b4fc' }}>3</span>
                    <span>Cada lead recebe uma <strong>temperatura</strong>, um <strong>score</strong> e uma <strong>etapa</strong> no funil.</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'var(--brand-glow)', color: '#a5b4fc' }}>4</span>
                    <span>Você vê o panorama no <strong>Dashboard</strong>, prioriza no <strong>Kanban</strong>, e age na aba <strong>Conversas</strong>.</span>
                  </li>
                </ol>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 2. FILA AGORA ─────────────────────── */}
          {shows('agora') && (
            <section className="mb-12">
              <SectionHeading
                id="agora"
                icon={Flame}
                title="Fila Agora"
                subtitle="Os leads que precisam de ação imediata — priorizados pela IA"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  O que é a Fila Agora
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  A <strong>Fila Agora</strong> é uma lista dinâmica dos leads que a IA considera
                  prioritários neste momento. Em vez de você varrer 200 conversas pra descobrir
                  quem precisa de atenção, o sistema monta a fila pra você — ranqueada por
                  urgência, temperatura e janela de oportunidade.
                </p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Ela aparece como um painel lateral acessível pelo ícone de
                  <strong> chama</strong> na sidebar ou pelo atalho no topo do Dashboard.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Como a IA monta a fila
                </h3>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Leads quentes sem resposta</strong> — temperatura alta + última mensagem do lead sem retorno do time.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Score subindo</strong> — leads que estavam mornos e tiveram pico de engajamento nas últimas horas.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Janela fechando</strong> — leads que vão esfriar se não houver ação em breve (baseado no histórico de decaimento).</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Follow-up vencido</strong> — leads com lembrete de retorno que já passou do horário.</span></li>
                </ul>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Como usar no dia a dia
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  Abra a Fila Agora, comece pelo primeiro da lista e vá descendo. Cada item mostra
                  o nome, a temperatura, o motivo da priorização e um botão pra abrir a conversa
                  direto. Ao resolver (responder, mover no Kanban ou inativar), o lead sai da fila
                  automaticamente.
                </p>
                <Tip>
                  Use a Fila Agora como sua <strong>lista de tarefas de vendas</strong>. Se a fila
                  está vazia, parabéns — todos os leads quentes foram atendidos.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Notificações da fila
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Quando um novo lead entra na fila, o ícone de chama na sidebar ganha um
                  <strong> badge numérico</strong> com a quantidade pendente. Se você já está em
                  outra conversa, um toast discreto aparece no canto — sem interromper o fluxo,
                  mas garantindo que nada passe despercebido.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Diferença entre Fila Agora e Filtro Quente
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  O filtro "Quente" em Conversas mostra <em>todos</em> os leads quentes,
                  independente de terem sido atendidos ou não. A <strong>Fila Agora</strong> mostra
                  apenas os que <em>precisam de ação agora</em> — é mais cirúrgica. Pense nela
                  como "quentes que ainda não receberam retorno".
                </p>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 3. DASHBOARD ─────────────────────── */}
          {shows('dashboard') && (
            <section className="mb-12">
              <SectionHeading
                id="dashboard"
                icon={LayoutDashboard}
                title="Dashboard"
                subtitle="O panorama executivo — métricas-chave em um painel só"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  O que você vê aqui
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  O Dashboard é a primeira parada do dia. Em ~30 segundos você sabe se o pipeline
                  está saudável, onde está perdendo lead e quais horários rendem mais.
                </p>
                <ul className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>KPIs no topo</strong> — total de leads, quentes, conversão, tempo de resposta.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Funil</strong> — cada etapa com quantidade e taxa de passagem.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Heatmap 1×24</strong> — intensidade de mensagens por hora do dia.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Objeções em cascata</strong> — principais motivos de não-fechamento.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Sparklines</strong> — tendência dos últimos 7 e 30 dias.</span></li>
                </ul>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Como ler os KPIs principais
                </h3>
                <div className="space-y-3 text-sm" style={{ color: 'var(--text-2)' }}>
                  <div>
                    <p className="font-medium mb-0.5" style={{ color: 'var(--text-1)' }}>Score do lead</p>
                    <p>Nota de 0 a 10 calculada pela IA. Considera engajamento, volume de mensagens, intenção de compra e progresso no funil. Acima de <strong>7</strong> = lead com alto potencial de fechar.</p>
                  </div>
                  <div>
                    <p className="font-medium mb-0.5" style={{ color: 'var(--text-1)' }}>Temperatura</p>
                    <p className="flex items-center gap-2 flex-wrap">
                      <Pill color="#ef4444">Quente</Pill> agir hoje •
                      <Pill color="#f97316">Morno</Pill> nutrir •
                      <Pill color="#3b82f6">Frio</Pill> reativar quando oportuno
                    </p>
                  </div>
                  <div>
                    <p className="font-medium mb-0.5" style={{ color: 'var(--text-1)' }}>Tempo até 1ª resposta</p>
                    <p>Quanto demorou do "oi" do lead até o primeiro retorno do bot/consultor. Impacto direto em conversão — ideal abaixo de 5 minutos.</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Heatmap de horário (1×24)
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  Uma faixa com 24 células — uma por hora. Quanto mais intensa a cor, mais volume
                  de mensagens nesse horário. Serve pra dimensionar time de atendimento e escalar
                  bot fora do expediente.
                </p>
                <Tip>
                  Se o pico é entre <strong>20h e 22h</strong> mas o time só responde até 18h, você
                  está perdendo janela de conversão. Ative o bot nesse intervalo ou reforce o time.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Funil animado + objeções
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  O funil mostra cada etapa do pipeline com a quantidade de leads e a taxa de
                  passagem pra próxima. Ao lado, as objeções mais frequentes em cascata: se
                  "preço" é 40% e "prazo" é 20%, você tem um argumento claro pra treinar o time.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Drill-down cruzado
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  Clique em qualquer segmento do funil, barra do heatmap ou fatia de objeção pra
                  abrir um <strong>drill-down</strong> que filtra os dados relacionados. Por exemplo:
                </p>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Clique na etapa "Proposta" do funil: veja só os leads nessa etapa.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Clique na hora "20h" do heatmap: veja as conversas que aconteceram nesse horário.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Clique na objeção "preço": veja os leads que mencionaram preço como barreira.</span></li>
                </ul>
                <Tip>
                  O drill-down cruza com os filtros de período já aplicados. Se você está olhando
                  "últimos 7 dias" e clica no funil, o resultado respeita esse recorte.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Exportar como PNG
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Todo painel pode ser exportado como imagem com marca-d'água do tenant. Útil pra
                  mandar no grupo do WhatsApp da diretoria ou anexar em report semanal.
                </p>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 4. KANBAN ─────────────────────── */}
          {shows('kanban') && (
            <section className="mb-12">
              <SectionHeading
                id="kanban"
                icon={Kanban}
                title="Kanban de Leads"
                subtitle="Pipeline visual — arraste e veja o lead avançar"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Como funciona
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  Cada <strong>coluna</strong> é uma etapa do funil (ex: novo, em conversa,
                  qualificado, proposta, fechado). Cada <strong>card</strong> é um lead com:
                </p>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Avatar colorido pela temperatura (anel vermelho/laranja/azul)</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Badge de score amarelo no canto</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Nome, última mensagem e data do follow-up</span></li>
                </ul>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Mover um card
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Arraste o card entre colunas pra atualizar a etapa. A mudança é salva no banco
                  imediatamente e reflete no Dashboard na próxima atualização de KPIs.
                </p>
                <Alert>
                  Mover um card <strong>não manda mensagem</strong> para o lead — é só uma mudança
                  de status interno. Pra contatar, abra a conversa.
                </Alert>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 5. CONVERSAS ─────────────────────── */}
          {shows('conversas') && (
            <section className="mb-12">
              <SectionHeading
                id="conversas"
                icon={MessageSquare}
                title="Conversas"
                subtitle="O chat completo de cada lead com insights em tempo real"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Lista da esquerda
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  Todos os leads do tenant, ordenados pela última mensagem. Cada item mostra:
                </p>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Avatar com anel colorido</strong> — vermelho (quente), laranja (morno), azul (frio). Sem anel = sem temperatura.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Badge amarelo</strong> com o score (0 a 10) no canto inferior direito do avatar.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Pílula de temperatura</strong> abaixo do nome pra leitura rápida.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span>Prévia da última mensagem com "Você:" quando foi enviada pelo time.</span></li>
                </ul>
                <Tip>
                  O botão de filtros abre um painel com temperatura, etapa, sentimento e período.
                  Combine filtros pra chegar a "quentes + sentimento negativo nos últimos 3 dias".
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Chat estilo WhatsApp
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  Ao clicar em uma conversa, as <strong>50 últimas mensagens</strong> aparecem
                  instantaneamente — o foco já vai pro final, no último envio. Se você rolar
                  pra cima, carrega mais 50, e assim sucessivamente, sem travar.
                </p>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Separadores de data</strong>: <em>Hoje</em> / <em>Ontem</em> / <em>Segunda-feira</em> / <em>12 de novembro de 2025</em></span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Bolhas</strong> — à esquerda do lead, à direita do time (cores diferenciam bot/IA/consultor/studio).</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Badges de mídia</strong> — quando a msg é áudio, imagem, vídeo ou documento, aparece um ícone em itálico.</span></li>
                </ul>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Painel Insights do Lead (direita)
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  Abre por padrão e mostra tudo que a IA já sabe sobre o lead: status, perfil
                  demográfico, análise IA (sentimento, intenção, próximo passo) e sinais de
                  negociação.
                </p>
                <Tip>
                  Quer mais espaço pro chat? Clique em <strong>Ocultar painel</strong> no canto
                  superior direito. Sua preferência fica salva — abre do mesmo jeito na próxima
                  vez. Pra reabrir, use o botão no header do chat.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Deep linking — abrir conversa por URL
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  Cada conversa tem uma <strong>URL única</strong> no formato
                  <code className="text-xs px-1.5 py-0.5 rounded mx-1"
                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-1)' }}
                  >/conversas/:leadId</code>.
                  Copie e cole em outro lugar (Slack, e-mail, planilha) pra que qualquer colega do
                  tenant abra direto naquele lead — sem precisar buscar na lista.
                </p>
                <Tip>
                  Use o botão <strong>Copiar link</strong> no header do chat ou o atalho
                  <KeyCap>Ctrl</KeyCap> + <KeyCap>L</KeyCap> pra copiar o deep link do lead atual
                  pra área de transferência.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Separadores de data no chat
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  As mensagens são agrupadas por dia com separadores visuais: <em>Hoje</em>,
                  <em> Ontem</em>, nome do dia da semana (ex: <em>Segunda-feira</em>) pra a última
                  semana, e data completa pra mensagens mais antigas (ex: <em>12 de novembro de
                  2025</em>). Isso facilita entender a cronologia sem precisar olhar horário por
                  horário.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Inativar lead
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Botão de arquivo (ícone caixa) no header do chat. Remove o lead da lista ativa
                  — útil pra leads que não existem mais (número errado, desistência confirmada, etc).
                  <strong> A conversa não é apagada</strong>: fica preservada no banco.
                </p>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 6. MODO ATENDIMENTO ─────────────────────── */}
          {shows('modo-foco') && (
            <section className="mb-12">
              <SectionHeading
                id="modo-foco"
                icon={Maximize2}
                title="Modo Atendimento"
                subtitle="Foco total em um lead — sem distrações na tela"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  O que é o Modo Atendimento
                </h3>
                <p className="text-sm mb-3" style={{ color: 'var(--text-2)' }}>
                  O <strong>Modo Atendimento</strong> (ou Modo Foco) expande a conversa atual
                  pra ocupar a tela inteira, escondendo a sidebar, a lista de conversas e
                  qualquer elemento que não seja o chat + painel de insights do lead selecionado.
                </p>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Ideal pra quando você está em uma negociação complexa e precisa de concentração
                  total — sem notificações de outros leads, sem KPIs competindo pela atenção.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Como ativar e desativar
                </h3>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Ativar:</strong> clique no ícone de expandir (setas diagonais) no header do chat, ou pressione <KeyCap>F</KeyCap> com o chat aberto.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Desativar:</strong> clique no ícone de minimizar ou pressione <KeyCap>Esc</KeyCap>. Você volta pra visualização normal com a lista de conversas.</span></li>
                </ul>
                <Tip>
                  O atalho <KeyCap>Esc</KeyCap> é universal pra sair de qualquer estado expandido
                  na Visão Comercial — modal, drawer, Modo Atendimento. Na dúvida, aperte Esc.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  O que fica visível no Modo Atendimento
                </h3>
                <ul className="space-y-1.5 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Chat completo</strong> — com mais espaço horizontal pra ler mensagens longas.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Painel de Insights</strong> — temperatura, score, sentimento, intenção, próximo passo, tudo à mão.</span></li>
                  <li className="flex gap-2"><ChevronRight size={14} className="mt-0.5 shrink-0" style={{ color: '#25c8bd' }} /><span><strong>Ações rápidas</strong> — inativar, mover no Kanban, copiar resumo da IA.</span></li>
                </ul>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Quando usar
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Use o Modo Atendimento quando estiver em atendimento ativo — respondendo
                  mensagens em tempo real, analisando histórico pra montar proposta, ou revisando
                  insights da IA pra decidir o próximo passo. Pra triagem rápida (só olhar quem
                  mandou mensagem), a visualização normal é mais eficiente.
                </p>
                <Alert>
                  No Modo Atendimento, notificações da Fila Agora continuam aparecendo como toast
                  discreto. Você não perde leads urgentes, mesmo em foco total.
                </Alert>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 7. ANÁLISE IA ──────────────────────── */}
          {shows('analise-ia') && (
            <section className="mb-12">
              <SectionHeading
                id="analise-ia"
                icon={Brain}
                title="Análise IA"
                subtitle="Como cada campo é calculado e como ele muda sua operação"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
                  <ThermometerSun size={14} style={{ color: '#ef4444' }} /> Temperatura
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  Classificação rápida da urgência do lead. Calculada com base em:
                </p>
                <ul className="space-y-1 text-sm ml-4" style={{ color: 'var(--text-2)' }}>
                  <li>• Volume de mensagens nas últimas 48h</li>
                  <li>• Tom emocional (sentimento positivo/misto)</li>
                  <li>• Presença de sinais de compra ("quanto custa", "como contratar")</li>
                  <li>• Tempo desde última interação</li>
                </ul>
                <p className="text-sm mt-2 flex gap-2 flex-wrap" style={{ color: 'var(--text-2)' }}>
                  <Pill color="#ef4444">Quente</Pill>
                  <Pill color="#f97316">Morno</Pill>
                  <Pill color="#3b82f6">Frio</Pill>
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
                  <Target size={14} style={{ color: '#eab308' }} /> Score (0 a 10)
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  Nota numérica que combina engajamento e intenção. Acima de 7 = foco total.
                  Entre 4 e 7 = nutrição. Abaixo de 4 = baixa prioridade ou reativação eventual.
                </p>
                <Tip>
                  O score é dinâmico — ele sobe quando o lead responde e cai quando some por dias.
                  Não trate como número fixo.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Sentimento
                </h3>
                <p className="text-sm flex flex-wrap gap-2" style={{ color: 'var(--text-2)' }}>
                  <Pill color="#22c55e">Positivo</Pill>
                  <Pill color="#94a3b8">Neutro</Pill>
                  <Pill color="#ef4444">Negativo</Pill>
                  <Pill color="#0e7490">Misto</Pill>
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--text-2)' }}>
                  Leitura da IA sobre o tom geral do lead nas últimas interações. Um <em>misto</em> em
                  lead quente merece atenção — pode estar em cima do muro.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Intenção e próximo passo
                </h3>
                <p className="text-sm mb-2" style={{ color: 'var(--text-2)' }}>
                  A IA identifica o que o lead <em>quer agora</em> (ex: tirar dúvida, agendar reunião,
                  negociar preço) e sugere a próxima ação do consultor. Aparece no painel de
                  Insights à direita.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Oportunidade aberta & motivos de não-fechamento
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Campo booleano que indica se ainda faz sentido insistir com o lead. Quando vira
                  "não", a IA preenche um motivo textual — essa coleção forma a seção de
                  <strong> Objeções em cascata</strong> no Dashboard. É ouro pra treinamento comercial.
                </p>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 8. PLAYBOOK ─────────────────────── */}
          {shows('playbook') && (
            <section className="mb-12">
              <SectionHeading
                id="playbook"
                icon={Workflow}
                title="Playbook — uso diário"
                subtitle="Rotina sugerida pra cada papel na operação"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Consultor — 15 minutos de manhã
                </h3>
                <ol className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li><strong>1.</strong> Abra a <em>Fila Agora</em> — comece pelo topo, que é o lead mais urgente.</li>
                  <li><strong>2.</strong> Pra cada lead da fila, entre na conversa e ative o <em>Modo Atendimento</em> se precisar de foco total.</li>
                  <li><strong>3.</strong> Leia o painel <em>Insights</em> (próximo passo sugerido pela IA) e responda.</li>
                  <li><strong>4.</strong> Quando a fila esvaziar, filtre por <strong>Morno</strong> sem resposta há 3+ dias — reengaje.</li>
                  <li><strong>5.</strong> Inative leads com número errado ou desistência confirmada.</li>
                </ol>
                <Tip>
                  A Fila Agora substitui o antigo "filtrar Quente + últimas 24h". Ela já faz essa
                  triagem pra você — e ainda inclui leads com follow-up vencido.
                </Tip>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Gestor — início e fim do dia
                </h3>
                <ol className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <li><strong>1.</strong> Abra <em>Dashboard</em>: veja o funil, taxas de passagem e tempo médio de resposta.</li>
                  <li><strong>2.</strong> Use o <em>drill-down cruzado</em> — clique na etapa com maior queda pra entender quais leads estão travados.</li>
                  <li><strong>3.</strong> Confira objeções em cascata — qual é a #1 da semana? Prepare treino do time.</li>
                  <li><strong>4.</strong> Confira quantos itens estão na <em>Fila Agora</em> do time — se acumula, o atendimento está lento.</li>
                  <li><strong>5.</strong> No fim do dia, exporte o painel como PNG e mande no grupo da diretoria.</li>
                </ol>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Operacional — Kanban
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Use o Kanban pra decisões de pipeline: mover cards reflete no Dashboard. Nunca
                  deixe um lead quente por mais de 24h na mesma etapa sem ação — isso vira
                  morno e depois frio.
                </p>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 9. CONFIGURAÇÕES ─────────────────────── */}
          {shows('configuracoes') && (
            <section className="mb-12">
              <SectionHeading
                id="configuracoes"
                icon={Settings}
                title="Configurações"
                subtitle="Personalização e conexões da empresa"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-1)' }}>
                  <BarChart3 size={14} style={{ color: '#25c8bd' }} /> Config KPIs
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Defina quais KPIs aparecem no Dashboard e em que ordem. Útil quando o cliente
                  quer focar em conversão de franquias vs. volume bruto, por exemplo. Disponível
                  pra perfil <strong>admin</strong> ou <strong>gestor</strong>.
                </p>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Conexões de WhatsApp
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Cada tenant pode ter múltiplos números conectados (bots, consultores). A
                  página <em>Conexões</em> mostra status (online/offline) e a última sync. Se
                  um número aparece offline, as mensagens não estão sendo puxadas — alerte
                  o time técnico.
                </p>
                <Alert>
                  O ícone "Sem números" no header aparece quando o tenant não tem nenhuma
                  conexão ativa. Isso significa que o Dashboard e Conversas estão mostrando
                  dados <strong>defasados</strong>.
                </Alert>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Multi-tenant
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Se você tem acesso a mais de um tenant (ex: é consultor de várias franquias),
                  o seletor no topo permite alternar. Cada tenant é isolado — os leads,
                  conversas e KPIs são separados.
                </p>
              </Card>
            </section>
          )}

          {/* ─────────────────────── 10. FAQ + ATALHOS ─────────────────────── */}
          {shows('atalhos-faq') && (
            <section className="mb-12">
              <SectionHeading
                id="atalhos-faq"
                icon={Keyboard}
                title="FAQ & atalhos"
                subtitle="Perguntas rápidas e atalhos de teclado"
              />

              <Card>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>
                  Perguntas frequentes
                </h3>
                <div className="space-y-3 text-sm" style={{ color: 'var(--text-2)' }}>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>Com que frequência o Dashboard atualiza?</p>
                    <p>Os KPIs recalculam continuamente conforme novas mensagens chegam. Recarregue a página ou clique em "Atualizar" pra forçar refresh.</p>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>Posso filtrar Conversas por período?</p>
                    <p>Sim — use o seletor "Todo período" no topo da lista pra escolher um intervalo custom (hoje, 7 dias, 30 dias, custom).</p>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>Como mudar o tema?</p>
                    <p>Botão de sol/lua no rodapé da sidebar. O tema fica salvo por usuário.</p>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>O que acontece se eu inativar um lead por engano?</p>
                    <p>A conversa fica preservada. Contate um admin pra reativar — a ação está no backend.</p>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>Como compartilho uma conversa com outro colega?</p>
                    <p>Use o deep link: copie a URL da conversa (<KeyCap>Ctrl</KeyCap> + <KeyCap>L</KeyCap> no chat) e cole no Slack ou e-mail. O colega abre direto naquele lead, desde que tenha acesso à empresa.</p>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>Como copiar o resumo da IA pra usar em outro lugar?</p>
                    <p>No painel de Insights, clique no ícone de cópia ao lado do resumo. O texto é copiado limpo pra área de transferência — ideal pra colar no CRM externo ou relatório.</p>
                  </div>
                  <div>
                    <p className="font-medium" style={{ color: 'var(--text-1)' }}>Qual a diferença entre a Fila Agora e o filtro de quentes?</p>
                    <p>O filtro mostra <em>todos</em> os leads quentes. A Fila Agora mostra apenas os que precisam de ação <em>agora</em> — quentes sem resposta, follow-ups vencidos e leads com janela fechando.</p>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-1)' }}>
                  Atalhos úteis
                </h3>
                <div className="space-y-2 text-sm" style={{ color: 'var(--text-2)' }}>
                  <div className="flex items-center gap-3">
                    <KeyCap>Ctrl</KeyCap> <span>+</span> <KeyCap>R</KeyCap>
                    <span>— recarregar dados da página (nativo do navegador)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <KeyCap>Ctrl</KeyCap> <span>+</span> <KeyCap>F</KeyCap>
                    <span>— busca na página atual (nativo do navegador)</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <KeyCap>Esc</KeyCap>
                    <span>— fecha modais, painéis e sai do Modo Atendimento</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <KeyCap>Ctrl</KeyCap> <span>+</span> <KeyCap>L</KeyCap>
                    <span>— copia o deep link da conversa atual</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <KeyCap>F</KeyCap>
                    <span>— ativa o Modo Atendimento (com chat aberto)</span>
                  </div>
                </div>
              </Card>

              <Card>
                <h3 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-1)' }}>
                  Suporte
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-2)' }}>
                  Dúvida técnica ou bug? Fale com o admin do seu tenant. Ele tem acesso direto
                  aos logs e pode escalar internamente.
                </p>
              </Card>
            </section>
          )}

          {filteredSections.length === 0 && (
            <EmptyState
              variant="empty"
              size="sm"
              icon={Search}
              title={`Nenhuma seção encontrada pra "${search}"`}
              description="Tente outra palavra."
            />
          )}
        </div>
      </div>
    </div>
  )
}
