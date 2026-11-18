/**
 * Helpers para geração de senha forte (uso: admin reseta senha de usuário).
 *
 * Critério: 12 chars com mix de maiúsculas, minúsculas, dígitos e símbolos.
 * Garante pelo menos 1 char de cada classe pra passar em validadores de
 * "complexidade" sem o usuário precisar trocar nada.
 */

const LOWER = 'abcdefghijkmnpqrstuvwxyz'     // sem 'l', 'o' (parecem 1/0)
const UPPER = 'ABCDEFGHJKLMNPQRSTUVWXYZ'     // sem 'I', 'O'
const DIGITS = '23456789'                     // sem 0, 1
const SYMBOLS = '!@#$%&*'

function pickRandom(set: string): string {
  const arr = new Uint32Array(1)
  crypto.getRandomValues(arr)
  return set[arr[0] % set.length]
}

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Gera uma senha forte de `length` caracteres (default 12).
 * Garante pelo menos 1 char de cada classe (lower, upper, digit, symbol).
 *
 * Usa `crypto.getRandomValues` quando disponível (todos os browsers
 * modernos suportam). Caracteres ambíguos (l, I, O, 0, 1) ficam de fora.
 */
export function generateStrongPassword(length: number = 12): string {
  if (length < 8) length = 8
  // 4 chars garantidos
  const required = [
    pickRandom(LOWER),
    pickRandom(UPPER),
    pickRandom(DIGITS),
    pickRandom(SYMBOLS),
  ]
  // O resto de uma pool unificada
  const pool = LOWER + UPPER + DIGITS + SYMBOLS
  const rest: string[] = []
  for (let i = 0; i < length - required.length; i++) {
    rest.push(pickRandom(pool))
  }
  return shuffle([...required, ...rest]).join('')
}
