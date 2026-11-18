import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import AOS from 'aos'
import 'aos/dist/aos.css'
import {
  ScanEye,
  Sparkles,
  Map,
  Columns,
  Timer,
  BarChart2,
  PieChart,
  Activity,
  BellRing,
  FileText,
  MessageSquare,
  Thermometer,
  ShieldCheck,
  Database,
  CheckSquare,
  Cpu,
  LineChart,
  ArrowRight,
  PlayCircle,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'

export default function LandingPage() {
  const navigate = useNavigate()
  const { isAuthenticated } = useAuthStore()

  useEffect(() => {
    AOS.init({
      once: true,
      offset: 120,
      easing: 'ease-out-cubic',
      duration: 700,
    })
  }, [])

  // Se já está autenticado, pula direto para o dashboard
  useEffect(() => {
    if (isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, navigate])

  const goLogin = () => navigate('/login')
  const goDemo = () => navigate('/login?demo=1')

  return (
    <div className="x9-landing antialiased">
      <style>{landingCss}</style>

      {/* Navbar */}
      <header className="fixed w-full top-0 z-50 bg-[#0B0F19]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ScanEye className="text-[#00FFA3] w-8 h-8" />
            <span className="landing-display font-bold text-2xl tracking-wide">Visão Comercial</span>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={goLogin}
              className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-semibold text-white/90 hover:text-white border border-white/10 hover:border-white/25 hover:bg-white/5 transition-all"
            >
              Entrar
            </button>
            <button
              onClick={goDemo}
              className="inline-flex items-center gap-2 bg-[#00FFA3] text-black px-6 sm:px-7 py-2.5 rounded-full font-bold text-sm tracking-wide shadow-[0_0_24px_rgba(0,255,163,0.35)] hover:scale-[1.03] hover:bg-white transition-all"
            >
              <PlayCircle className="w-4 h-4" />
              Ver demo
            </button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-44 pb-32 px-6">
        <div className="glowing-orb w-[800px] h-[800px] bg-[#00FFA3]/10 top-0 left-1/2 -translate-x-1/2" />

        <div className="max-w-5xl mx-auto text-center relative z-10" data-aos="fade-up" data-aos-duration="1000">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[#00FFA3]/30 bg-[#00FFA3]/5 text-[#00FFA3] text-sm font-semibold mb-8">
            <Sparkles className="w-4 h-4" /> Inteligência para sua operação comercial
          </div>
          <h1 className="landing-display text-5xl md:text-7xl font-extrabold leading-[1.05] mb-6">
            Pare de perder venda <br />
            por <span className="text-gradient">conversa mal feita.</span>
          </h1>
          <p className="text-lg md:text-xl text-gray-400 font-light max-w-2xl mx-auto mb-10">
            Uma IA treinada para auditar 100% das conversas do seu time no WhatsApp. Ela aponta o lead
            esquecido, a objeção real e o vendedor que está deixando dinheiro na mesa.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
            <button
              onClick={goDemo}
              className="group inline-flex items-center gap-2 bg-[#00FFA3] text-black px-8 py-4 rounded-full font-bold text-base shadow-[0_0_40px_rgba(0,255,163,0.25)] hover:scale-[1.03] hover:bg-white transition-all"
            >
              Entrar no demo agora
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>
            <button
              onClick={goLogin}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold underline-offset-4 hover:underline"
            >
              Já tenho conta · Entrar
            </button>
          </div>
        </div>

        <div
          className="max-w-7xl mx-auto relative z-20 group"
          data-aos="zoom-in-up"
          data-aos-duration="1200"
          data-aos-delay="200"
        >
          <div className="absolute -inset-4 bg-gradient-to-r from-[#00FFA3]/20 to-[#3B82F6]/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000 -z-10 rounded-[3rem]" />
          <img
            src="/demo-preview.svg"
            alt="Visão Geral do Painel"
            className="w-full rounded-2xl img-3d-shadow animate-float border border-white/10"
          />
        </div>
      </section>

      {/* TIMELINE DO PRODUTO */}
      <div className="relative max-w-7xl mx-auto px-6 pb-40">
        <div className="timeline-line hidden lg:block" />

        {/* 1. PANORAMA */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2" data-aos="fade-right">
            <Map className="text-[#00FFA3] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Panorama Geográfico e Fluxo</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Visão macro da operação: de onde vem o volume real, quais estados respondem pela maior
              parte da sua receita e onde vale dobrar esforço comercial.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-left">
            <div className="glass-panel p-2 animate-float-reverse">
              <img src="/demo-preview.svg" className="w-full rounded-xl" alt="Panorama geográfico ilustrativo" />
            </div>
          </div>
        </section>

        {/* 2. KANBAN MESTRE */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2 lg:pl-12" data-aos="fade-left">
            <Columns className="text-[#3B82F6] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">
              Kanban que se move <br />
              <span className="text-[#3B82F6]">sozinho.</span>
            </h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Chega de depender do vendedor atualizar CRM. Cada card é movido pela IA a partir do
              conteúdo real da conversa. Você vê a etapa do funil que o cliente está, não a que o
              vendedor jurou que ele estava.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-right">
            <div className="glass-panel p-2 animate-float">
              <img src="/demo-preview.svg" className="w-full rounded-xl" alt="Kanban ilustrativo" />
            </div>
          </div>
        </section>

        {/* 3. SLA DE RESPOSTA — usa 5_ia_dando_bronca que mostra "Tempo médio 1ª resposta" */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 lg:pr-12" data-aos="fade-right">
            <Timer className="text-red-400 w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Tempo real de atendimento. Sem achismo.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Quantos minutos o seu cliente espera antes da primeira resposta? A Visão Comercial mede, expõe e
              compara por vendedor. Defina um SLA claro e saiba na hora quem está furando.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-left">
            <div className="glass-panel p-4">
              <img src="/demo-preview.svg" className="w-full rounded-lg" alt="SLA de resposta ilustrativo" />
            </div>
          </div>
        </section>

        {/* 4. GARGALO DE HORÁRIOS */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2 lg:pl-12" data-aos="fade-left">
            <BarChart2 className="text-orange-400 w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Descubra as janelas em que você está perdendo dinheiro.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Sobreponha o horário em que o cliente manda mensagem com o horário em que o time
              responde. Encontre os buracos — aquele pico de leads quentes das 20h que ninguém
              atende — e corrija a escala.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-right">
            <div className="glass-panel p-4">
              <img src="/demo-preview.svg" className="w-full rounded-lg" alt="Gargalo de horários ilustrativo" />
            </div>
          </div>
        </section>

        {/* 5. OBJEÇÕES REAIS */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 lg:pr-12" data-aos="fade-right">
            <PieChart className="text-[#00FFA3] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">A verdade sobre por que a venda não fechou.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              "Achou caro" não é diagnóstico. A IA lê cada conversa perdida e classifica o motivo real:
              preço, prazo, dúvida técnica, sem capital, concorrência. Pare de otimizar o problema
              errado.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="flip-left">
            <div className="glass-panel p-2 animate-float">
              <img src="/demo-preview.svg" className="w-full rounded-lg" alt="Objeções ilustrativas" />
            </div>
          </div>
        </section>

        {/* 6. COACHING IA — usa 8_auditoria_chat que mostra card "Melhoria de Atendimento Sugerida" */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2 lg:pl-12" data-aos="fade-left">
            <Activity className="text-[#00B8FF] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Um coach de vendas por cima do ombro do seu time.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              A cada conversa, a IA sugere o que poderia ter sido feito diferente: a objeção que
              ficou no ar, o gatilho que não foi usado, o follow-up que não aconteceu. Feedback
              contínuo, sem reunião de alinhamento.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="zoom-in">
            <div className="glass-panel p-6 border-b border-[#00B8FF]/40">
              <img src="/demo-preview.svg" className="w-full rounded" alt="Coaching ilustrativo" />
            </div>
          </div>
        </section>

        {/* 7. ALERTAS DE ABANDONO */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 lg:pr-12" data-aos="fade-right">
            <BellRing className="text-red-500 w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">O alarme que toca antes do lead virar fumaça.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Lead quente parado há 4 horas sem resposta? A Visão Comercial destaca, notifica o gerente e
              bota na frente de quem importa. Risco mitigado no ato, sem depender de quem lembrou.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="zoom-out-up">
            <div className="glass-panel p-2 shadow-[0_0_50px_rgba(239,68,68,0.1)]">
              <img src="/demo-preview.svg" className="w-full rounded" alt="Alertas ilustrativos" />
            </div>
          </div>
        </section>

        {/* 8. CONVERSAS FULL */}
        <section className="py-24 relative z-10 text-center">
          <div data-aos="fade-up">
            <MessageSquare className="text-[#00FFA3] w-12 h-12 mx-auto mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-6">Central de auditoria. Tudo em um lugar.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed max-w-3xl mx-auto mb-16">
              Todas as conversas do WhatsApp oficial organizadas, filtráveis por vendedor, temperatura
              e etapa. Rastreamento visual, histórico completo e busca que funciona.
            </p>
            <div className="glass-panel p-2 scale-[1.02] hover:scale-[1.04] transition-transform duration-700">
              <img src="/demo-preview.svg" className="w-full rounded-xl" alt="Central de conversas ilustrativa" />
            </div>
          </div>
        </section>

        {/* 9. TERMÔMETRO */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2 lg:pl-12" data-aos="fade-left">
            <Thermometer className="text-orange-500 w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Qual a temperatura do seu pipeline hoje?</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Veja em um único termômetro quantos leads estão quentes, mornos ou frios, e quanto do
              pipeline esfriou nos últimos 7 dias. Fácil de entender, impossível de maquiar.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-right">
            <div className="glass-panel p-4 rounded-full max-w-md mx-auto">
              <img src="/demo-preview.svg" className="w-full inline-block" alt="Termômetro ilustrativo" />
            </div>
          </div>
        </section>

        {/* 10. SCORE 1-10 */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 lg:pr-12" data-aos="fade-right">
            <ShieldCheck className="text-[#00FFA3] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Uma régua de 1 a 10 para cada lead.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              A IA lê a conversa inteira e devolve uma nota objetiva de qualificação. Foque 100% do
              esforço comercial em quem está acima de 7 e pare de investir em lead que nunca ia
              fechar.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-left">
            <div className="glass-panel p-6 animate-float">
              <img src="/demo-preview.svg" className="w-full rounded-md" alt="Score ilustrativo" />
            </div>
          </div>
        </section>

        {/* 11. CRIADOR KPI */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2 lg:pl-12" data-aos="fade-left">
            <Database className="text-[#00B8FF] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Você escreve o KPI. A IA extrai.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Seu negócio tem métricas únicas? Digite em português o que você quer saber ("orçamento
              disponível", "porte da empresa", "prazo para decisão") e a IA monta a coluna
              automaticamente em cima das conversas. Text-to-data, no seu controle.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-up" data-aos-duration="800">
            <div className="glass-panel p-2 shadow-lg">
              <img
                src="/demo-preview.svg"
                className="w-full rounded border border-white/10"
                alt="Criador de KPI"
              />
            </div>
          </div>
        </section>

        {/* 12. ARSENAL DE KPIS */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 lg:pr-12" data-aos="fade-right">
            <CheckSquare className="text-[#00FFA3] w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Arsenal de KPIs prontos, de fábrica.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Dezenas de indicadores prontos para ativar com um clique: tempo
              médio de fechamento, taxa de abandono, curva de objeção, índice de recorrência. Plug
              and play.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="fade-up" data-aos-delay="200">
            <div className="glass-panel p-4">
              <img
                src="/demo-preview.svg"
                className="w-full border border-white/5 rounded-lg"
                alt="Arsenal de KPIs"
              />
            </div>
          </div>
        </section>

        {/* 13. VOLUME AUTOMAÇÃO */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row-reverse items-center gap-16">
          <div className="lg:w-1/2 lg:pl-12" data-aos="fade-left">
            <Cpu className="text-gray-400 w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">Quanto do seu time já é máquina.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              A IA absorve o primeiro atendimento ponta a ponta. Os painéis mostram exatamente o
              volume de trabalho resolvido sem humano — e quanta energia sobrou para a equipe focar
              no lead que decide.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="zoom-out-right">
            <div className="glass-panel p-4">
              <img src="/demo-preview.svg" className="w-full rounded" alt="Volume ilustrativo" />
            </div>
          </div>
        </section>

        {/* 14. CURVA DE SENTIMENTO */}
        <section className="py-24 relative z-10 flex flex-col lg:flex-row items-center gap-16">
          <div className="lg:w-1/2 lg:pr-12" data-aos="fade-right">
            <LineChart className="text-red-400 w-12 h-12 mb-6 opacity-80" />
            <h2 className="text-4xl landing-display font-bold mb-4">A curva emocional da sua operação.</h2>
            <p className="text-lg text-gray-400 font-light leading-relaxed">
              Um radar em tempo real do clima das conversas. Picos de satisfação, vales de atrito,
              quedas bruscas de humor — tudo em uma linha que mostra quando e por que o
              relacionamento esfriou.
            </p>
          </div>
          <div className="lg:w-1/2" data-aos="flip-down">
            <div className="glass-panel p-6 border-t border-[#00FFA3]/20">
              <img src="/demo-preview.svg" className="w-full rounded" alt="Curva ilustrativa" />
            </div>
          </div>
        </section>
      </div>

      {/* FOOTER CTA */}
      <footer className="py-32 border-t border-white/5 relative overflow-hidden bg-[#05070A]">
        <div className="glowing-orb w-[600px] h-[600px] bg-[#00FFA3]/5 bottom-0 left-1/2 -translate-x-1/2 opacity-50" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10" data-aos="fade-up">
          <div className="flex items-center justify-center gap-3 mb-8 opacity-80">
            <ScanEye className="text-[#00FFA3] w-10 h-10" />
            <span className="landing-display font-bold text-3xl tracking-wide">Visão Comercial</span>
          </div>
          <h2 className="text-4xl lg:text-5xl landing-display font-bold mb-4">
            Gestão à prova de falhas, <br />
            para times que jogam pra ganhar.
          </h2>
          <p className="text-lg text-gray-400 font-light max-w-xl mx-auto mb-10">
            Entre no demo agora e veja a Visão Comercial analisar conversas fictícias em poucos minutos.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
            <button
              onClick={goDemo}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-[#00FFA3] to-[#00cc82] text-black px-10 py-4 rounded-full font-bold text-lg hover:scale-105 transition-transform shadow-[0_0_40px_rgba(0,255,163,0.25)]"
            >
              <PlayCircle className="w-5 h-5" />
              Ver demo agora
            </button>
            <button
              onClick={goLogin}
              className="inline-flex items-center gap-2 text-white/80 hover:text-white text-sm font-semibold underline-offset-4 hover:underline"
            >
              Já sou cliente · Entrar
            </button>
          </div>
          <div className="border-t border-white/5 pt-12 text-sm text-gray-600 font-medium">
            <p>Copyright © 2026 Visão Comercial · Todos os direitos reservados.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}

const landingCss = `
.x9-landing {
  background-color: #0B0F19;
  color: #ffffff;
  font-family: 'Inter', sans-serif;
  overflow-x: hidden;
  min-height: 100vh;
}
.x9-landing .landing-display {
  font-family: 'Outfit', sans-serif;
}
.x9-landing ::selection {
  background: #00FFA3;
  color: #000;
}

.x9-landing .glass-panel {
  background: linear-gradient(145deg, rgba(30,36,51,0.6) 0%, rgba(15,20,33,0.9) 100%);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid rgba(255,255,255,0.05);
  border-radius: 24px;
  position: relative;
  transition: all 0.5s ease;
}
.x9-landing .glass-panel:hover {
  border-color: rgba(0,255,163,0.3);
  box-shadow: 0 20px 50px rgba(0,0,0,0.8), 0 0 20px rgba(0,255,163,0.05);
}

.x9-landing .text-gradient {
  background: linear-gradient(to right, #00FFA3, #00B8FF);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  color: transparent;
}

.x9-landing .img-3d-shadow {
  box-shadow: 0 30px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.05);
}

.x9-landing .timeline-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  background: linear-gradient(to bottom, transparent, rgba(0,255,163,0.3) 10%, rgba(59,130,246,0.3) 90%, transparent);
  z-index: 0;
  transform: translateX(-50%);
  pointer-events: none;
}
@media (max-width: 1024px) {
  .x9-landing .timeline-line { left: 24px; }
}

.x9-landing .glowing-orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(100px);
  z-index: 0;
  pointer-events: none;
}

@keyframes x9-float {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-15px); }
}
@keyframes x9-float-reverse {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(15px); }
}
.x9-landing .animate-float {
  animation: x9-float 6s ease-in-out infinite;
}
.x9-landing .animate-float-reverse {
  animation: x9-float-reverse 8s ease-in-out infinite;
}
`
