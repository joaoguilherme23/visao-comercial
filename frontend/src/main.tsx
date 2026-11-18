import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './index.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            // Usa nosso slide-in padronizado; keyframes vivem em index.css (respeitam
            // prefers-reduced-motion). Fallback mantém estilo consistente com o tema.
            className: 'animate-slide-in-right',
            style: {
              background: 'var(--toast-bg)',
              color: 'var(--toast-text)',
              border: '1px solid var(--toast-border)',
              borderRadius: '12px',
              boxShadow: '0 10px 24px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15)',
            },
            // Toast de sucesso = Tier 1 (momento de marca). Usa signal-success-500
            // (#10E088) da Fase 2 + glow verde sutil. Não confundir com KPIs
            // de variação positiva (Tier 2, #22c55e).
            success: {
              iconTheme: {
                primary: '#10E088',
                secondary: '#033821',
              },
              style: {
                background: 'var(--toast-bg)',
                color: 'var(--toast-text)',
                border: '1px solid rgba(16,224,136,0.35)',
                borderRadius: '12px',
                boxShadow: '0 10px 24px rgba(0,0,0,0.25), var(--glow-success-sm)',
              },
            },
          }}
        />
      </QueryClientProvider>
    </BrowserRouter>
  </React.StrictMode>
)
