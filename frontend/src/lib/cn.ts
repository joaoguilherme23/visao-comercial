import { clsx, type ClassValue } from 'clsx'

/**
 * Helper pra compor classes Tailwind condicionalmente.
 * Mesmo pattern do shadcn/ui, mas sem `tailwind-merge` (não temos no projeto).
 */
export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs)
}
