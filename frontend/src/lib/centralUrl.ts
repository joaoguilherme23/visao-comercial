export const OIDC_ENABLED = import.meta.env.VITE_OIDC_ENABLED === 'true'

// This fallback is only reachable in the SSO build. The production/JWT build
// neither renders Central links nor embeds this navigation behavior.
export const CENTRAL_URL = import.meta.env.VITE_CENTRAL_URL || ''
