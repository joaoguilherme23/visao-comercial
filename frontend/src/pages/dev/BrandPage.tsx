import { Eye, TrendingUp, Users } from 'lucide-react'

const principles = [
  ['Clareza comercial', 'Indicadores e conversas apresentados de forma objetiva para apoiar decisões.'],
  ['Evidência antes de opinião', 'Toda análise deve ser verificável no contexto da operação.'],
  ['Foco no time', 'A interface ajuda gestores e equipes a priorizarem o próximo passo.'],
]

export default function BrandPage() {
  return (
    <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-10">
      <header className="rounded-3xl border border-white/10 bg-gradient-to-br from-[#10242a] to-[#101725] p-8 md:p-12">
        <div className="flex items-center gap-3 text-[#36d5ca] mb-5"><Eye size={28} /><span className="font-semibold">Guia de marca</span></div>
        <h1 className="text-4xl md:text-5xl font-black tracking-tight text-white">Visão Comercial</h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">Inteligência de vendas para transformar conversas em decisões comerciais mais claras.</p>
      </header>
      <section className="grid gap-4 md:grid-cols-3">
        {principles.map(([title, description], index) => {
          const Icon = index === 0 ? TrendingUp : index === 1 ? Eye : Users
          return <article key={title} className="rounded-2xl border border-white/10 bg-white/[0.03] p-6"><Icon className="mb-4 text-[#36d5ca]" /><h2 className="font-bold text-white">{title}</h2><p className="mt-2 text-sm leading-6 text-slate-300">{description}</p></article>
        })}
      </section>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-6">
        <h2 className="font-bold text-white">Uso na demonstração local</h2>
        <p className="mt-2 text-slate-300">A prévia usa somente dados sintéticos e não estabelece conexões com provedores externos.</p>
      </section>
    </main>
  )
}
