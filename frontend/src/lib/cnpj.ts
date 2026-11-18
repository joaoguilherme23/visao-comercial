/**
 * Helpers para CNPJ.
 *
 * Validação roda no backend também (`schemas/tenant.py`), mas validar
 * no cliente economiza request e dá feedback instantâneo.
 */

/** Remove tudo que não é dígito. */
export function unmaskCNPJ(value: string): string {
  return (value || '').replace(/\D/g, '')
}

/** Formata 14 dígitos como `XX.XXX.XXX/XXXX-XX`. */
export function formatCNPJ(value: string): string {
  const d = unmaskCNPJ(value).slice(0, 14)
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12, 14)}`
}

/** Valida CNPJ — retorna true se 14 dígitos + algoritmo dos 2 verificadores. */
export function isValidCNPJ(value: string): boolean {
  const d = unmaskCNPJ(value)
  if (d.length !== 14) return false
  if (/^(\d)\1+$/.test(d)) return false // dígitos repetidos

  const calcDigit = (base: string, weights: number[]): number => {
    const sum = base.split('').reduce((acc, ch, i) => acc + Number(ch) * weights[i], 0)
    const rest = sum % 11
    return rest < 2 ? 0 : 11 - rest
  }

  const w1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  const w2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
  if (calcDigit(d.slice(0, 12), w1) !== Number(d[12])) return false
  if (calcDigit(d.slice(0, 13), w2) !== Number(d[13])) return false
  return true
}
