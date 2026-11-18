import { useState, RefObject } from 'react'
import { Download, Loader2 } from 'lucide-react'
import { exportElementAsPng } from '../../lib/exportPng'

interface Props {
  /** Ref pro elemento que será exportado. Use `useRef<HTMLDivElement>(null)`. */
  targetRef: RefObject<HTMLElement>
  /** Nome base do arquivo — será kebab-case-zado e ganha data no final. */
  filename: string
  /** Label da marca d'água. Default: "Visão Comercial". */
  watermark?: string
  /** Subtítulo da marca (ex: período). Default: data atual. */
  watermarkSub?: string
  /** Classe extra no botão. */
  className?: string
  /** Label visível. Default: "Exportar PNG". */
  label?: string
}

/**
 * Botão compacto pra exportar um container como PNG com watermark.
 *
 * Uso:
 *   const ref = useRef<HTMLDivElement>(null)
 *   <div ref={ref}>...conteúdo...</div>
 *   <ExportPngButton targetRef={ref} filename="dashboard-tenant" />
 *
 * O próprio botão se marca com `data-export-skip="1"` pra não aparecer no PNG
 * quando está dentro do container capturado.
 */
export default function ExportPngButton({
  targetRef,
  filename,
  watermark,
  watermarkSub,
  className,
  label = 'Exportar PNG',
}: Props) {
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (!targetRef.current || busy) return
    setBusy(true)
    try {
      await exportElementAsPng(targetRef.current, { filename, watermark, watermarkSub })
    } catch {
      // toast já foi mostrado dentro de exportElementAsPng
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      data-export-skip="1"
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-wait ${className ?? ''}`}
      style={{
        background: 'var(--bg-elevated)',
        color: 'var(--text-2)',
        border: '1px solid var(--border)',
      }}
      title="Salva uma imagem PNG do dashboard atual"
    >
      {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
      <span>{label}</span>
    </button>
  )
}
