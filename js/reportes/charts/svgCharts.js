/**
 * svgCharts.js - Gráficas SVG livianas sin dependencias externas.
 *
 * Funciones disponibles:
 *   renderBarChart(container, data, options)
 *   renderPieChart(container, data, options)
 *   renderLineChart(container, data, options)
 */

const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
]

// ─────────────────────────────────────────────────────────────────
// BAR CHART
// data: [{ label: string, value: number }]
// options: { title, width, height, color, valuePrefix, valueSuffix }
// ─────────────────────────────────────────────────────────────────
export function renderBarChart(container, data, options = {}) {
  if (!container || !data?.length) {
    container && (container.innerHTML = '<p class="chart-empty">Sin datos para mostrar</p>')
    return
  }

  const {
    title = '',
    width = container.offsetWidth || 320,
    height = 220,
    color = COLORS[0],
    valuePrefix = '',
    valueSuffix = ''
  } = options

  const paddingLeft = 8
  const paddingRight = 8
  const paddingTop = title ? 30 : 8
  const paddingBottom = 48
  const chartW = width - paddingLeft - paddingRight
  const chartH = height - paddingTop - paddingBottom

  const maxValue = Math.max(...data.map(d => d.value), 1)
  const barW = Math.max(1, (chartW / data.length) - 6)

  const bars = data.map((d, i) => {
    const barH = Math.round((d.value / maxValue) * chartH)
    const x = paddingLeft + i * (chartW / data.length) + 3
    const y = paddingTop + chartH - barH
    const valueLabel = `${valuePrefix}${_abbrev(d.value)}${valueSuffix}`

    return `
      <rect x="${x}" y="${y}" width="${barW}" height="${barH}"
            fill="${color}" rx="3" opacity="0.85"/>
      <text x="${x + barW / 2}" y="${y - 4}" text-anchor="middle"
            font-size="10" fill="#374151">${barH > 0 ? valueLabel : ''}</text>
      <text x="${x + barW / 2}" y="${paddingTop + chartH + 16}" text-anchor="middle"
            font-size="9" fill="#6b7280" transform="rotate(-30,${x + barW / 2},${paddingTop + chartH + 16})">${_truncate(d.label, 8)}</text>
    `
  }).join('')

  const titleEl = title
    ? `<text x="${width / 2}" y="18" text-anchor="middle" font-size="12" font-weight="600" fill="#111827">${title}</text>`
    : ''

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="overflow:visible">
      ${titleEl}
      ${bars}
      <line x1="${paddingLeft}" y1="${paddingTop + chartH}" x2="${width - paddingRight}" y2="${paddingTop + chartH}"
            stroke="#e5e7eb" stroke-width="1"/>
    </svg>
  `
}

// ─────────────────────────────────────────────────────────────────
// PIE / DONUT CHART
// data: [{ label: string, value: number }]
// options: { title, size, donut }
// ─────────────────────────────────────────────────────────────────
export function renderPieChart(container, data, options = {}) {
  if (!container || !data?.length) {
    container && (container.innerHTML = '<p class="chart-empty">Sin datos para mostrar</p>')
    return
  }

  const {
    title = '',
    size = Math.min(container.offsetWidth || 220, 220),
    donut = true
  } = options

  const total = data.reduce((s, d) => s + d.value, 0)
  if (total === 0) {
    container.innerHTML = '<p class="chart-empty">Sin datos</p>'
    return
  }

  const cx = size / 2
  const cy = size / 2
  const r = size * 0.38
  const innerR = donut ? r * 0.55 : 0

  let startAngle = -Math.PI / 2
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI
    const endAngle = startAngle + angle
    const x1 = cx + r * Math.cos(startAngle)
    const y1 = cy + r * Math.sin(startAngle)
    const x2 = cx + r * Math.cos(endAngle)
    const y2 = cy + r * Math.sin(endAngle)
    const xi1 = cx + innerR * Math.cos(endAngle)
    const yi1 = cy + innerR * Math.sin(endAngle)
    const xi2 = cx + innerR * Math.cos(startAngle)
    const yi2 = cy + innerR * Math.sin(startAngle)
    const large = angle > Math.PI ? 1 : 0
    const pct = Math.round((d.value / total) * 100)

    const path = donut
      ? `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${xi1} ${yi1} A ${innerR} ${innerR} 0 ${large} 0 ${xi2} ${yi2} Z`
      : `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`

    // Etiqueta centrada en el slice
    const midAngle = startAngle + angle / 2
    const labelR = r * 0.78
    const lx = cx + labelR * Math.cos(midAngle)
    const ly = cy + labelR * Math.sin(midAngle)
    const labelEl = pct >= 8
      ? `<text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" font-size="10" fill="white" font-weight="600">${pct}%</text>`
      : ''

    startAngle = endAngle
    return { path, color: COLORS[i % COLORS.length], label: d.label, pct, labelEl }
  })

  const legend = slices.map((s, i) => `
    <g transform="translate(0, ${i * 18})">
      <rect width="10" height="10" rx="2" fill="${s.color}"/>
      <text x="15" y="9" font-size="10" fill="#374151">${_truncate(s.label, 18)} (${s.pct}%)</text>
    </g>
  `).join('')

  const titleEl = title
    ? `<text x="${size / 2}" y="14" text-anchor="middle" font-size="12" font-weight="600" fill="#111827">${title}</text>`
    : ''

  const svgH = size + (title ? 20 : 0)
  const legendY = title ? size + 22 : size + 8

  container.innerHTML = `
    <svg viewBox="0 0 ${size} ${svgH + slices.length * 18 + 8}" width="100%">
      ${titleEl}
      <g transform="translate(0,${title ? 20 : 0})">
        ${slices.map(s => `<path d="${s.path}" fill="${s.color}" opacity="0.9"/>`).join('')}
        ${slices.map(s => s.labelEl).join('')}
      </g>
      <g transform="translate(12, ${legendY})">${legend}</g>
    </svg>
  `
}

// ─────────────────────────────────────────────────────────────────
// LINE CHART (para rentabilidad mensual)
// data: [{ label: string, value: number }]
// ─────────────────────────────────────────────────────────────────
export function renderLineChart(container, data, options = {}) {
  if (!container || !data?.length) {
    container && (container.innerHTML = '<p class="chart-empty">Sin datos para mostrar</p>')
    return
  }

  const {
    title = '',
    width = container.offsetWidth || 320,
    height = 180,
    color = COLORS[0],
    valuePrefix = ''
  } = options

  const padL = 12, padR = 12, padT = title ? 28 : 8, padB = 40
  const chartW = width - padL - padR
  const chartH = height - padT - padB
  const maxValue = Math.max(...data.map(d => d.value), 1)

  const pts = data.map((d, i) => {
    const x = padL + (i / Math.max(data.length - 1, 1)) * chartW
    const y = padT + chartH - (d.value / maxValue) * chartH
    return { x, y, label: d.label, value: d.value }
  })

  const polyline = pts.map(p => `${p.x},${p.y}`).join(' ')
  const area = `M ${pts[0].x},${padT + chartH} ` +
    pts.map(p => `L ${p.x},${p.y}`).join(' ') +
    ` L ${pts[pts.length - 1].x},${padT + chartH} Z`

  const dots = pts.map(p => `
    <circle cx="${p.x}" cy="${p.y}" r="4" fill="${color}"/>
    <title>${p.label}: ${valuePrefix}${_abbrev(p.value)}</title>
  `).join('')

  const labels = pts.map(p => `
    <text x="${p.x}" y="${padT + chartH + 16}" text-anchor="middle" font-size="9" fill="#6b7280"
          transform="rotate(-30,${p.x},${padT + chartH + 16})">${p.label}</text>
  `).join('')

  const titleEl = title
    ? `<text x="${width / 2}" y="16" text-anchor="middle" font-size="12" font-weight="600" fill="#111827">${title}</text>`
    : ''

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" width="100%" style="overflow:visible">
      ${titleEl}
      <defs>
        <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${color}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${color}" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <path d="${area}" fill="url(#lineGrad)"/>
      <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round"/>
      ${dots}
      ${labels}
      <line x1="${padL}" y1="${padT + chartH}" x2="${width - padR}" y2="${padT + chartH}" stroke="#e5e7eb"/>
    </svg>
  `
}

// ─── helpers privados ────────────────────────────────────────────
function _abbrev(n) {
  if (n == null || isNaN(n)) return '0'
  if (Math.abs(n) >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(0) + 'K'
  return Number(n).toFixed(0)
}

function _truncate(str, max) {
  if (!str) return ''
  return str.length > max ? str.slice(0, max) + '…' : str
}
