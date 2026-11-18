import { CENTRAL_URL } from '../../lib/centralUrl'
import '../../styles/central-signout.css'

interface CentralSignoutProps {
  onReturnToApp: () => void
}

export function CentralSignout({ onReturnToApp }: CentralSignoutProps) {
  return (
    <main className="central-signout">
      <section className="central-signout__card" aria-labelledby="signout-title">
        <p className="central-signout__brand">CENTRAL DE ACESSO</p>
        <span className="central-signout__icon" aria-hidden="true">✓</span>
        <p className="central-signout__app">Visão Comercial</p>
        <h1 className="central-signout__title" id="signout-title">Você saiu do aplicativo</h1>
        <p className="central-signout__message">Sua sessão neste aplicativo foi encerrada.</p>
        <div className="central-signout__actions">
          <button type="button" className="central-signout__button" onClick={onReturnToApp}>
            Voltar ao aplicativo
          </button>
          <a href={CENTRAL_URL} className="central-signout__button central-signout__button--secondary">
            Voltar à Central
          </a>
        </div>
        <p className="central-signout__note">Sua sessão na Central pode continuar ativa.</p>
      </section>
    </main>
  )
}
