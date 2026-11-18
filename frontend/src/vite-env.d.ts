/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_OIDC_ENABLED?: string
  readonly VITE_OIDC_API_URL?: string
  readonly VITE_CENTRAL_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
