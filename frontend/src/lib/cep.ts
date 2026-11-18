/**
 * Integração com ViaCEP — endpoint público, sem auth.
 *
 * Quando o usuário digita um CEP completo (8 dígitos), buscamos os dados
 * do endereço e preenchemos rua/bairro/cidade/UF automaticamente. O
 * usuário só precisa completar com número e complemento.
 */

export interface ViaCEPResponse {
  cep: string
  logradouro: string
  complemento: string
  bairro: string
  localidade: string  // cidade
  uf: string
  ibge?: string
  erro?: boolean
}

export interface AddressFromCEP {
  cep: string
  logradouro: string
  bairro: string
  cidade: string
  uf: string
}

export function unmaskCEP(value: string): string {
  return (value || '').replace(/\D/g, '')
}

/** Formata 8 dígitos como `XXXXX-XXX`. */
export function formatCEP(value: string): string {
  const d = unmaskCEP(value).slice(0, 8)
  if (d.length <= 5) return d
  return `${d.slice(0, 5)}-${d.slice(5, 8)}`
}

/** A demonstração local não consulta serviços de endereço externos. */
export async function fetchAddressByCEP(_cep: string, _signal?: AbortSignal): Promise<AddressFromCEP | null> {
  return null
}
