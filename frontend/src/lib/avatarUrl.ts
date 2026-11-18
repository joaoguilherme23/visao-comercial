/**
 * Resolve a URL pública de um avatar salvo no backend.
 *
 * Backend retorna foto_url relativa: "/avatars/leads/<id>/<ts>.jpg".
 * Como é servido pelo MESMO host do API (StaticFiles em /avatars), basta
 * concatenar o origin do VITE_API_URL (sem o /api/v1).
 *
 * Se foto_url já vier absoluta (http/https), retorna como está.
 */
const API_URL = import.meta.env.VITE_API_URL ?? '/api/v1'

// Origin do backend = VITE_API_URL sem o "/api/v1" final
function backendOrigin(): string {
  try {
    const u = new URL(API_URL, window.location.origin)
    return `${u.protocol}//${u.host}`
  } catch {
    return ''
  }
}

export function resolveAvatarUrl(fotoUrl: string | null | undefined): string | null {
  if (!fotoUrl) return null
  if (/^https?:\/\//.test(fotoUrl)) return fotoUrl
  if (fotoUrl.startsWith('/')) {
    return `${backendOrigin()}${fotoUrl}`
  }
  return fotoUrl
}
