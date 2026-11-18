/** Keeps legacy purple chart/notification colors within the X9 palette. */
export function brandColor(color?: string | null): string {
  if (!color) return '#0b9692'
  const value = color.trim().toLowerCase()
  if (['purple', 'violet', 'indigo'].includes(value)) return '#0b9692'
  if (!/^#[0-9a-f]{6}([0-9a-f]{2})?$/.test(value)) return color

  const [r, g, b] = [1, 3, 5].map(start => parseInt(value.slice(start, start + 2), 16) / 255)
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const delta = max - min
  if (delta === 0 || delta / max < 0.15) return color

  const sector = max === r ? (g - b) / delta : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4
  const hue = (sector * 60 + 360) % 360
  if (hue >= 235 && hue <= 310) return (hue < 250 ? '#0b9692' : '#0e7490') + value.slice(7)
  return color
}
