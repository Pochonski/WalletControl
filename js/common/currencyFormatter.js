/**
 * currencyFormatter — Formateo y parseo de valores monetarios.
 * Funciones puras, sin DOM ni side effects.
 */

const DEFAULT_LOCALE   = 'es-DO'  // Español República Dominicana
const DEFAULT_CURRENCY = 'DOP'    // Peso dominicano

/**
 * Formatea un número como moneda.
 * @param {number} amount
 * @param {string} [currency=DEFAULT_CURRENCY]
 * @param {string} [locale=DEFAULT_LOCALE]
 * @returns {string}  Ej: 'RD$ 12,500.00'
 */
export function formatCurrency(amount, currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Formatea un número como moneda compacta (sin decimales si es entero).
 * @param {number} amount
 * @param {string} [currency=DEFAULT_CURRENCY]
 * @returns {string}  Ej: 'RD$ 12,500'
 */
export function formatCurrencyCompact(amount, currency = DEFAULT_CURRENCY) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

/**
 * Formatea solo el número sin símbolo de moneda.
 * @param {number} amount
 * @returns {string}  Ej: '12,500.00'
 */
export function formatNumber(amount) {
  if (amount == null || isNaN(amount)) return '—'
  return new Intl.NumberFormat(DEFAULT_LOCALE, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Parsea un string de moneda o número a float.
 * Elimina símbolos y separadores de miles.
 * @param {string} str
 * @returns {number}
 */
export function parseCurrency(str) {
  if (!str) return 0
  // Eliminar todo excepto dígitos, punto y coma
  const cleaned = String(str).replace(/[^0-9.,]/g, '')
  // Normalizar: si hay coma como decimal (1.000,50) → convertir a 1000.50
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned
  const result = parseFloat(normalized)
  return isNaN(result) ? 0 : result
}

/**
 * Formatea un porcentaje.
 * @param {number} value  - Ej: 10.5
 * @returns {string}      - Ej: '10.50%'
 */
export function formatPercent(value) {
  if (value == null || isNaN(value)) return '—'
  return `${Number(value).toFixed(2)}%`
}

/**
 * Formatea un monto en forma abreviada (K, M).
 * @param {number} amount
 * @returns {string}  Ej: 'RD$ 1.2M' | 'RD$ 50K'
 */
export function formatCurrencyAbbrev(amount) {
  if (amount == null || isNaN(amount)) return '—'
  const abs = Math.abs(amount)
  const sign = amount < 0 ? '-' : ''
  if (abs >= 1_000_000) return `${sign}RD$ ${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000)     return `${sign}RD$ ${(abs / 1_000).toFixed(1)}K`
  return formatCurrency(amount)
}
