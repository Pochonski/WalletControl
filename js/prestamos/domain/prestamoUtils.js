/**
 * prestamoUtils.js
 * Utilidades financieras compartidas para el módulo de Préstamos.
 * Funciones puras, sin DOM ni side effects.
 */

import { addDays, addMonths, toISODate, parseDate } from '../../common/dateUtils.js'

// ─────────────────────────────────────────────────────────────────────────────
// 1. FRECUENCIA → DÍAS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Retorna los días de intervalo para una frecuencia de pago.
 * Para MENSUAL y ANUAL retorna null porque se usan meses reales.
 * @param {string} frecuencia
 * @returns {{ dias: number|null, meses: number|null }}
 */
export function getDiasPorFrecuencia(frecuencia) {
    switch ((frecuencia || '').toUpperCase()) {
        case 'DIARIO': return { dias: 1, meses: null }
        case 'INTERDIARIO': return { dias: 2, meses: null }
        case 'SEMANAL': return { dias: 7, meses: null }
        case 'BISEMANAL': return { dias: 14, meses: null }
        case 'QUINCENAL': return { dias: 15, meses: null }
        case '15_Y_FIN_MES': return { dias: 15, meses: null }
        case 'MENSUAL': return { dias: null, meses: 1 }
        case 'ANUAL': return { dias: null, meses: 12 }
        default: return { dias: 30, meses: null }
    }
}

/**
 * Avanza una fecha ISO una cuota hacia adelante según la frecuencia.
 * Usa meses reales para MENSUAL y ANUAL.
 * @param {string} isoDate
 * @param {string} frecuencia
 * @returns {string} nueva fecha ISO
 */
export function avanzarFecha(isoDate, frecuencia) {
    const { dias, meses } = getDiasPorFrecuencia(frecuencia)
    if (meses !== null) return addMonths(isoDate, meses)
    return addDays(isoDate, dias)
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. CÁLCULO DE FECHA FIN
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Calcula la fecha fin del préstamo a partir de la fecha del primer pago,
 * el número de cuotas y la frecuencia, usando meses/días reales.
 * @param {string} fechaPrimerPago  - ISO 'YYYY-MM-DD'
 * @param {number} numCuotas
 * @param {string} frecuencia
 * @returns {string} fecha fin ISO
 */
export function calcularFechaFin(fechaPrimerPago, numCuotas, frecuencia) {
    if (!fechaPrimerPago || !numCuotas || numCuotas <= 0) return null

    const { dias, meses } = getDiasPorFrecuencia(frecuencia)
    const cuotasExtra = numCuotas - 1   // la cuota 1 ya está en fechaPrimerPago

    if (meses !== null) {
        return addMonths(fechaPrimerPago, meses * cuotasExtra)
    }
    return addDays(fechaPrimerPago, dias * cuotasExtra)
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CÁLCULOS PMT Y DE INTERÉS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Estima la tasa por período a partir de la tasa mensual y la frecuencia.
 * @param {number} tasaMensualPct  - porcentaje mensual (ej: 10 = 10%)
 * @param {string} frecuencia
 * @returns {number} tasa decimal por período
 */
export function getTasaPorPeriodo(tasaMensualPct, frecuencia) {
    const tasa = tasaMensualPct / 100
    const { dias, meses } = getDiasPorFrecuencia(frecuencia)
    if (meses !== null) {
        // Para mensual: tasa directa; para anual: tasa * 12
        return tasa * meses
    }
    // Días: proporcional a 30 días base mensual
    return tasa * (dias / 30)
}

/**
 * Calcula la cuota fija usando la fórmula PMT (interés compuesto).
 * Para tipos donde toda la cuota es solo interés, retorna monto_interes.
 *
 * @param {number} monto          - Capital del préstamo
 * @param {number} tasaMensualPct - Tasa de interés mensual en %
 * @param {number} numCuotas      - Número total de cuotas
 * @param {string} tipo           - CUOTA_FIJA | INTERES_FIJO | DISMINUIR_CUOTA | CAPITAL_AL_FINAL
 * @param {string} frecuencia     - Frecuencia de pago
 * @returns {{ cuota: number, interesPeriodo: number, label: string }}
 */
export function calcularMontoCuota(monto, tasaMensualPct, numCuotas, tipo, frecuencia) {
    if (!monto || !tasaMensualPct || !numCuotas) {
        return { cuota: 0, interesPeriodo: 0, label: '' }
    }

    const r = getTasaPorPeriodo(tasaMensualPct, frecuencia)
    const interesPorPeriodo = monto * r

    switch ((tipo || '').toUpperCase()) {
        case 'CUOTA_FIJA': {
            // Fórmula PMT: C = P * r / (1 - (1+r)^-n)
            if (r === 0) {
                const cuota = monto / numCuotas
                return { cuota, interesPeriodo: 0, label: 'Cuota fija (sin interés)' }
            }
            const cuota = monto * r / (1 - Math.pow(1 + r, -numCuotas))
            return { cuota, interesPeriodo, label: 'Cuota fija (capital + interés)' }
        }

        case 'INTERES_FIJO': {
            // Solo paga interés cada período; capital al final
            return { cuota: interesPorPeriodo, interesPeriodo, label: 'Solo interés por período' }
        }

        case 'DISMINUIR_CUOTA': {
            // Primera cuota (la mayor): amortización fija + interés sobre saldo total
            const amortizacion = monto / numCuotas
            const cuota = amortizacion + interesPorPeriodo
            return { cuota, interesPeriodo, label: 'Cuota decrece (primera cuota)' }
        }

        case 'CAPITAL_AL_FINAL': {
            // Solo interés hasta la última cuota
            return { cuota: interesPorPeriodo, interesPeriodo, label: 'Interés hasta vencimiento' }
        }

        default:
            return { cuota: interesPorPeriodo, interesPeriodo, label: 'Interés estimado' }
    }
}

/**
 * Calcula el interés total de todo el préstamo.
 * @param {number} monto
 * @param {number} tasaMensualPct
 * @param {number} numCuotas
 * @param {string} tipo
 * @param {string} frecuencia
 * @returns {number}
 */
export function calcularInteresTotal(monto, tasaMensualPct, numCuotas, tipo, frecuencia) {
    if (!monto || !tasaMensualPct || !numCuotas) return 0

    const r = getTasaPorPeriodo(tasaMensualPct, frecuencia)

    switch ((tipo || '').toUpperCase()) {
        case 'CUOTA_FIJA': {
            if (r === 0) return 0
            const cuota = monto * r / (1 - Math.pow(1 + r, -numCuotas))
            return (cuota * numCuotas) - monto
        }
        case 'INTERES_FIJO':
        case 'CAPITAL_AL_FINAL':
            return monto * r * numCuotas

        case 'DISMINUIR_CUOTA': {
            // Suma de intereses = r * monto * (n+1) / 2
            return r * monto * (numCuotas + 1) / 2
        }
        default:
            return monto * r * numCuotas
    }
}

/**
 * Calcula el número de cuotas default según la frecuencia (fallback).
 * @param {string} frecuencia
 * @returns {number}
 */
export function getCuotasDefault(frecuencia) {
    switch ((frecuencia || '').toUpperCase()) {
        case 'DIARIO': return 365
        case 'INTERDIARIO': return 180
        case 'SEMANAL': return 52
        case 'BISEMANAL': return 26
        case 'QUINCENAL': return 24
        case '15_Y_FIN_MES': return 24
        case 'MENSUAL': return 12
        case 'ANUAL': return 3
        default: return 12
    }
}
