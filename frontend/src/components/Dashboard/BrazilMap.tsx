import { useState, useMemo, memo, useCallback, useEffect, useRef } from 'react'
import { scaleSqrt } from 'd3-scale'
import { useThemeStore } from '../../store/themeStore'

const GEO_URL = '/brazil-states.geojson'
const HEAT_COLORS_LIGHT = ['#d7f4f1', '#a7e8e2', '#73d7cf', '#42c9c0', '#25b9b0', '#169d98', '#0f7777', '#0b5559']
const HEAT_COLORS_DARK = ['#123f42', '#14565a', '#147277', '#168e91', '#1aa9a7', '#22c1b8', '#5cddd0', '#a8f1e7']

const W = 400
const H = 380

interface DataItem {
  sigla: string
  nome: string
  total: number
  pct: number
}

interface GeoFeature {
  type: string
  geometry: {
    type: 'Polygon' | 'MultiPolygon'
    coordinates: number[][][] | number[][][][]
  }
  properties: { sigla: string; nome: string }
}

interface Projection {
  lonMin: number
  lonRange: number
  latMin: number
  latRange: number
}

// Simple equirectangular projection fitting the features to W×H
function buildProjection(features: GeoFeature[]): Projection {
  let lonMin = Infinity, lonMax = -Infinity
  let latMin = Infinity, latMax = -Infinity

  const visitRing = (ring: number[][]) => {
    ring.forEach(([lon, lat]) => {
      if (lon < lonMin) lonMin = lon
      if (lon > lonMax) lonMax = lon
      if (lat < latMin) latMin = lat
      if (lat > latMax) latMax = lat
    })
  }

  features.forEach(f => {
    if (f.geometry.type === 'Polygon') {
      (f.geometry.coordinates as number[][][]).forEach(visitRing)
    } else {
      (f.geometry.coordinates as number[][][][]).forEach(poly => poly.forEach(visitRing))
    }
  })

  // Add a bit of padding
  const pad = 0.5
  lonMin -= pad; lonMax += pad
  latMin -= pad; latMax += pad

  return {
    lonMin,
    lonRange: lonMax - lonMin,
    latMin,
    latRange: latMax - latMin,
  }
}

// Project [lon, lat] → [x, y] in SVG space
function project(lon: number, lat: number, proj: Projection): [number, number] {
  const x = ((lon - proj.lonMin) / proj.lonRange) * W
  // Invert Y: lat increases upward, SVG Y increases downward
  const y = ((proj.latMin + proj.latRange - lat) / proj.latRange) * H
  return [x, y]
}

// Convert a ring (array of [lon,lat]) to SVG path commands
function ringToPath(ring: number[][], proj: Projection): string {
  return ring.map(([lon, lat], i) => {
    const [x, y] = project(lon, lat, proj)
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
  }).join('') + 'Z'
}

// Convert a GeoJSON Feature geometry to a full SVG path `d` string
function featureToSVGPath(feat: GeoFeature, proj: Projection): string {
  const geom = feat.geometry
  if (geom.type === 'Polygon') {
    return (geom.coordinates as number[][][]).map(r => ringToPath(r, proj)).join(' ')
  } else {
    return (geom.coordinates as number[][][][])
      .flatMap(poly => poly.map(r => ringToPath(r, proj)))
      .join(' ')
  }
}

// ─────────────────────────────────────────────────────────────────

interface BrazilMapProps {
  data?: DataItem[]
  onClickEstado?: (item: DataItem) => void
}

function BrazilMapInner({ data, onClickEstado }: BrazilMapProps) {
  const theme = useThemeStore((state) => state.theme)
  const heatColors = theme === 'dark' ? HEAT_COLORS_DARK : HEAT_COLORS_LIGHT
  const noDataFill = theme === 'dark' ? '#17282b' : '#e6f7f5'
  const [hovered, setHovered] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ item: DataItem; x: number; y: number } | null>(null)
  const [statePaths, setStatePaths] = useState<{ sigla: string; d: string }[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  const items = data ?? []
  const maxTotal = Math.max(...items.map(i => i.total), 1)

  const dataMap = useMemo(() => {
    const m = new Map<string, DataItem>()
    items.forEach(i => m.set(i.sigla, i))
    return m
  }, [items])

  const colorScale = useMemo(() => {
    const domain = heatColors.map((_, i) => (i / (heatColors.length - 1)) * maxTotal)
    return scaleSqrt<string>().domain(domain).range(heatColors).clamp(true)
  }, [maxTotal, heatColors])

  const getFill = useCallback(
    (sigla: string) => {
      const item = dataMap.get(sigla)
      if (!item) return noDataFill
      return colorScale(item.total)
    },
    [dataMap, colorScale, noDataFill],
  )

  // Load GeoJSON and compute SVG paths via manual projection
  useEffect(() => {
    fetch(GEO_URL)
      .then(r => r.json())
      .then((geojson) => {
        const feats: GeoFeature[] = geojson.features
        const proj = buildProjection(feats)
        const paths = feats.map(f => ({
          sigla: f.properties.sigla,
          d: featureToSVGPath(f, proj),
        }))
        setStatePaths(paths)
      })
      .catch(console.error)
  }, [])

  const handleMouseMove = useCallback((sigla: string, e: React.MouseEvent) => {
    setHovered(sigla)
    const item = dataMap.get(sigla)
    if (!item) { setTooltip(null); return }
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) setTooltip({ item, x: e.clientX - rect.left, y: e.clientY - rect.top })
  }, [dataMap])

  const handleMouseLeave = useCallback(() => { setHovered(null); setTooltip(null) }, [])

  return (
    <div className="card-surface p-5 h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Leads por Estado
        </p>
        {items.length > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>0</span>
            <div className="h-2.5 w-24 rounded-sm overflow-hidden flex">
              {heatColors.map((c, i) => (
                <div key={i} className="flex-1 h-full" style={{ background: c }} />
              ))}
            </div>
            <span className="text-[11px]" style={{ color: 'var(--text-3)' }}>{maxTotal.toLocaleString('pt-BR')}</span>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-gray-600 text-sm text-center py-6">Sem dados para o período</p>
      ) : (
        <div className="flex gap-4 flex-1 min-h-0">
          <div className="flex-1 relative" ref={containerRef}>
            <svg
              viewBox={`0 0 ${W} ${H}`}
              style={{ width: '100%', height: 'auto', maxHeight: 340, display: 'block' }}
            >
              {statePaths.map(({ sigla, d }) => {
                const isHov = hovered === sigla
                const hasData = dataMap.has(sigla)
                return (
                  <path
                    key={sigla}
                    d={d}
                    fill={getFill(sigla)}
                    stroke={isHov ? 'var(--brand-500)' : 'rgba(148,163,184,0.6)'}
                    strokeWidth={isHov ? 2 : 0.8}
                    strokeLinejoin="round"
                    style={{ cursor: hasData ? 'pointer' : 'default' }}
                    onMouseMove={(e) => handleMouseMove(sigla, e)}
                    onMouseLeave={handleMouseLeave}
                    onClick={() => { const it = dataMap.get(sigla); if (it) onClickEstado?.(it) }}
                  />
                )
              })}
            </svg>

            {tooltip && (
              <div
                className="absolute pointer-events-none z-50"
                style={{
                  left: tooltip.x > 220 ? tooltip.x - 8 : tooltip.x + 14,
                  top: Math.max(0, tooltip.y - 55),
                  transform: tooltip.x > 220 ? 'translateX(-100%)' : 'none',
                }}
              >
                <div
                  className="rounded-lg px-3 py-2 shadow-xl"
                  style={{
                    background: 'rgba(15,23,42,0.96)',
                    border: '1px solid rgba(37,200,189,0.35)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.45)',
                    backdropFilter: 'blur(4px)',
                  }}
                >
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: '#ffffff' }}
                  >
                    {tooltip.item.sigla} — {tooltip.item.nome}
                  </p>
                  <p className="text-[12px]" style={{ color: '#cbd5e1' }}>
                    <span style={{ color: '#ffffff', fontWeight: 700 }}>
                      {tooltip.item.total.toLocaleString('pt-BR')}
                    </span>{' '}
                    leads · {tooltip.item.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="w-32 flex-shrink-0 overflow-auto" style={{ maxHeight: 340 }}>
            <p className="text-[11px] uppercase tracking-wider mb-2 font-semibold" style={{ color: 'var(--text-3)' }}>Top Estados</p>
            <div className="space-y-0.5">
              {items.slice(0, 12).map((item) => {
                const isHov = hovered === item.sigla
                return (
                  <button
                    key={item.sigla}
                    className="w-full flex items-center gap-1.5 rounded px-1.5 py-1 transition-colors hover:bg-white/5"
                    style={isHov ? { background: 'rgba(255,255,255,0.07)' } : undefined}
                    onMouseEnter={() => setHovered(item.sigla)}
                    onMouseLeave={() => setHovered(null)}
                    onClick={() => onClickEstado?.(item)}
                  >
                    <span
                      className="text-[10px] font-bold w-6 text-center rounded leading-5 flex-shrink-0"
                      style={{ background: colorScale(item.total), color: item.total / maxTotal > 0.4 ? '#000' : '#fff' }}
                    >
                      {item.sigla}
                    </span>
                    <span className="text-[11px] flex-1 text-left tabular-nums" style={{ color: 'var(--text-2)' }}>
                      {item.total.toLocaleString('pt-BR')}
                    </span>
                    <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-3)' }}>{item.pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const BrazilMap = memo(BrazilMapInner)
export default BrazilMap
