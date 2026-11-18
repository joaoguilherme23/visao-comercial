import toast from 'react-hot-toast'
import type { AxiosError } from 'axios'
import { AlertTriangle } from 'lucide-react'

/**
 * Wrappers em cima do react-hot-toast que padronizam:
 *  - extração de motivo de erros axios (usa `detail` do FastAPI)
 *  - botão "tentar novamente" opcional
 *  - duração coerente (erros duram mais que sucessos)
 */

type MaybeAxiosError = AxiosError<{ detail?: unknown }> | Error | unknown

function extractMessage(err: MaybeAxiosError, fallback: string): string {
  if (!err) return fallback
  const anyErr = err as AxiosError<{ detail?: unknown }>
  const detail = anyErr?.response?.data?.detail
  if (typeof detail === 'string' && detail.trim()) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    // Pydantic retorna [{ loc, msg, type }] — junta as primeiras mensagens
    return (
      detail
        .map((d: unknown) => {
          if (d && typeof d === 'object' && 'msg' in d) {
            return String((d as { msg?: string }).msg ?? '')
          }
          return ''
        })
        .filter(Boolean)
        .slice(0, 2)
        .join(' · ') || fallback
    )
  }
  if (err instanceof Error && err.message) return err.message
  return fallback
}

export interface ToastErrorOptions {
  /** Mensagem genérica se não conseguir extrair do erro. */
  fallback?: string
  /** Se informado, adiciona botão "Tentar novamente" no toast. */
  retry?: () => void
  /** Duração em ms (default: 6000 com retry, 4500 sem). */
  duration?: number
}

interface RetryToastProps {
  message: string
  onRetry?: () => void
  toastId: string
}

function RetryToast({ message, onRetry, toastId }: RetryToastProps) {
  return (
    <div
      style={{
        background: 'var(--toast-bg)',
        color: 'var(--toast-text)',
        border: '1px solid var(--toast-border)',
        borderRadius: 12,
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
        maxWidth: 420,
      }}
    >
      <AlertTriangle size={18} color="#f87171" style={{ flexShrink: 0 }} />
      <span style={{ fontSize: 13, lineHeight: 1.4 }}>{message}</span>
      {onRetry && (
        <button
          type="button"
          onClick={() => {
            onRetry()
            toast.dismiss(toastId)
          }}
          style={{
            marginLeft: 'auto',
            background: 'transparent',
            color: '#a5b4fc',
            border: '1px solid rgba(165,180,252,0.4)',
            borderRadius: 8,
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 500,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function toastError(err: MaybeAxiosError, opts: ToastErrorOptions = {}): string {
  const message = extractMessage(err, opts.fallback ?? 'Algo deu errado')
  const duration = opts.duration ?? (opts.retry ? 6000 : 4500)

  if (opts.retry) {
    return toast.custom(
      (t) => <RetryToast message={message} onRetry={opts.retry} toastId={t.id} />,
      { duration }
    )
  }

  return toast.error(message, { duration })
}

export function toastSuccess(msg: string, duration = 3000): string {
  return toast.success(msg, { duration })
}

export function toastInfo(msg: string, duration = 3500): string {
  return toast(msg, { duration })
}

export { toast as rawToast }
