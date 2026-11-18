import { toPng } from 'html-to-image'
import toast from 'react-hot-toast'

interface ExportOptions {
  /** Nome do arquivo SEM extensão. Será normalizado pra kebab-case. */
  filename: string
  /** Label da marca d'água no rodapé. Default: "Visão Comercial". */
  watermark?: string
  /** Subtítulo da marca d'água (ex: periodo). Default: data atual. */
  watermarkSub?: string
  /** Multiplicador de resolução. 2 = retina. Default 2. */
  pixelRatio?: number
}

/**
 * Captura um elemento DOM como PNG e dispara download. Aplica uma watermark
 * fixa no canto inferior direito via clone temporário — não modifica o DOM
 * original. Útil pra compartilhar printscreens de dashboard sem ter que
 * abrir ferramenta externa.
 *
 * Implementação: usa `html-to-image` pra renderizar o elemento em um canvas.
 * Antes da captura, injeta um elemento filho absoluto com a marca d'água;
 * removemos ele ao final (try/finally) pra não poluir o DOM mesmo em caso
 * de erro. O elemento precisa estar visível e ter tamanho definido.
 */
export async function exportElementAsPng(
  element: HTMLElement,
  opts: ExportOptions,
): Promise<void> {
  const watermark = opts.watermark ?? 'Visão Comercial'
  const watermarkSub = opts.watermarkSub ?? new Date().toLocaleDateString('pt-BR')
  const pixelRatio = opts.pixelRatio ?? 2

  // Cria a marca d'água como overlay no próprio elemento (não é clone).
  // Motivo: clone mandatório duplica queries/legendas e dá problema em canvas
  // — overlay direto no elemento é o mais simples e confiável.
  const mark = document.createElement('div')
  mark.setAttribute('data-export-watermark', '1')
  mark.style.cssText = [
    'position:absolute',
    'bottom:8px',
    'right:12px',
    'pointer-events:none',
    'display:flex',
    'flex-direction:column',
    'align-items:flex-end',
    'gap:1px',
    'font-family:Inter,system-ui,sans-serif',
    'font-size:10px',
    'line-height:1.2',
    'color:rgba(148,163,184,0.75)',
    'z-index:9999',
  ].join(';')
  mark.innerHTML = `
    <span style="font-weight:700;letter-spacing:0.04em">${watermark}</span>
    <span style="opacity:0.75">${watermarkSub}</span>
  `

  // Precisamos garantir position:relative no container pra o absolute funcionar.
  const originalPosition = element.style.position
  const needsReposition = !originalPosition || originalPosition === 'static'
  if (needsReposition) element.style.position = 'relative'

  element.appendChild(mark)

  const loadingToast = toast.loading('Gerando PNG…')

  try {
    const dataUrl = await toPng(element, {
      pixelRatio,
      cacheBust: true,
      backgroundColor: getComputedStyle(element).backgroundColor || '#0c1019',
      // Ignora canvas externos (como BrazilMap SVG que já é canvas-compatível)
      filter: (node) => {
        // Skip elementos com data-export-skip — útil pra botões/toolbars
        if (node instanceof HTMLElement && node.dataset.exportSkip === '1') return false
        return true
      },
    })

    // Dispara o download
    const safeName = opts.filename
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    const link = document.createElement('a')
    link.download = `${safeName || 'dashboard'}-${new Date().toISOString().slice(0, 10)}.png`
    link.href = dataUrl
    link.click()

    toast.success('PNG exportado', { id: loadingToast })
  } catch (err) {
    console.error('[exportPng] falhou:', err)
    toast.error('Não foi possível gerar o PNG', { id: loadingToast })
    throw err
  } finally {
    // Limpa o overlay e restaura o style original
    mark.remove()
    if (needsReposition) element.style.position = originalPosition
  }
}
