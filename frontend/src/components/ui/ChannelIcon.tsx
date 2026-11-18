import {
  MessageCircle,
  Instagram,
  Mail,
  MessageSquare,
  Phone,
  Globe,
  Send,
  type LucideIcon,
} from 'lucide-react'

export type Channel =
  | 'whatsapp'
  | 'instagram'
  | 'messenger'
  | 'email'
  | 'sms'
  | 'telegram'
  | 'phone'
  | 'web'
  | string

interface ChannelIconProps {
  channel?: Channel | null
  size?: number
  /** Se true, adiciona um fundo circular tintado (útil em cards/avatars). */
  withBg?: boolean
  /** Força cor — default: cor "oficial" do canal. */
  color?: string
  className?: string
  title?: string
}

/**
 * Mapa do canal → ícone + cor oficial da marca. Centralizar aqui evita
 * inconsistência entre listas, cards e conversas.
 *
 * Notas:
 *  - Cores são aproximações da brand; dá pra ajustar sem mudar call-sites.
 *  - `withBg` pinta um círculo de fundo em 14% de opacidade da cor.
 */
const CHANNEL_MAP: Record<string, { Icon: LucideIcon; color: string; label: string }> = {
  whatsapp:  { Icon: MessageCircle,  color: '#25D366', label: 'WhatsApp' },
  instagram: { Icon: Instagram,      color: '#E4405F', label: 'Instagram' },
  messenger: { Icon: MessageSquare,  color: '#0084FF', label: 'Messenger' },
  email:     { Icon: Mail,           color: '#EA4335', label: 'E-mail' },
  sms:       { Icon: MessageSquare,  color: '#64748b', label: 'SMS' },
  telegram:  { Icon: Send,           color: '#0088CC', label: 'Telegram' },
  phone:     { Icon: Phone,          color: '#0b9692', label: 'Telefone' },
  web:       { Icon: Globe,          color: '#06b6d4', label: 'Web' },
}

export default function ChannelIcon({
  channel,
  size = 14,
  withBg = false,
  color,
  className,
  title,
}: ChannelIconProps) {
  const key = (channel ?? '').toString().toLowerCase()
  const spec = CHANNEL_MAP[key]
  if (!spec) return null
  const c = color ?? spec.color

  if (withBg) {
    const pad = Math.max(4, Math.round(size * 0.35))
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full flex-shrink-0 ${className ?? ''}`}
        style={{
          width: size + pad * 2,
          height: size + pad * 2,
          background: `${c}24`, // alpha ~14%
          color: c,
        }}
        title={title ?? spec.label}
        aria-label={title ?? spec.label}
      >
        <spec.Icon size={size} />
      </span>
    )
  }

  return (
    <spec.Icon
      size={size}
      className={`flex-shrink-0 ${className ?? ''}`}
      style={{ color: c }}
      aria-label={title ?? spec.label}
    />
  )
}
