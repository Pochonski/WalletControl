/**
 * calcularCuotasCredito.js
 * Lógica de dominio pura para generar el calendario de cuotas
 * de un crédito recibido por el prestamista.
 *
 * Sigue los mismos tipos de amortización que los préstamos emitidos:
 *   CUOTA_FIJA       → cuota constante (principal + interés calculados con PMT)
 *   DISMINUIR_CUOTA  → principal fijo, interés sobre saldo decreciente
 *   INTERES_FIJO     → solo paga intereses periódicos, capital al final
 *   CAPITAL_AL_FINAL → paga interés flat sobre capital total, capital al final
 */

const DIAS_POR_FRECUENCIA = {
  DIARIO:       1,
  INTERDIARIO:  2,
  SEMANAL:      7,
  BISEMANAL:    14,
  QUINCENAL:    15,
  MENSUAL:      30,
  ANUAL:        365,
}

/**
 * Avanza una fecha según la frecuencia de pago.
 * Maneja correctamente MENSUAL y 15_Y_FIN_MES.
 *
 * @param {Date} fecha
 * @param {string} frecuencia
 * @param {number} paso - Número de período a sumar
 * @returns {Date}
 */
function sumarPeriodo(fecha, frecuencia, paso = 1) {
  const d = new Date(fecha)

  if (frecuencia === 'MENSUAL' || frecuencia === 'ANUAL') {
    const meses = frecuencia === 'ANUAL' ? 12 * paso : paso
    d.setMonth(d.getMonth() + meses)
    return d
  }

  if (frecuencia === '15_Y_FIN_MES') {
    // Alterna entre día 15 y último día del mes
    if (d.getDate() < 15) {
      d.setDate(15)
    } else {
      d.setMonth(d.getMonth() + 1, 1)
      d.setDate(0) // último día del mes siguiente
    }
    return d
  }

  const dias = DIAS_POR_FRECUENCIA[frecuencia] ?? 30
  d.setDate(d.getDate() + dias * paso)
  return d
}

/**
 * Calcula el número de períodos entre dos fechas según la frecuencia.
 */
function calcularNumCuotas(fechaInicio, fechaPrimerPago, frecuencia) {
  // Estimación rápida basada en días
  const msTotal = new Date(fechaInicio).getTime() - new Date(fechaPrimerPago).getTime()
  const diasTotal = Math.abs(msTotal / (1000 * 60 * 60 * 24))

  if (frecuencia === 'MENSUAL') return Math.round(diasTotal / 30) || 1
  if (frecuencia === 'ANUAL')   return Math.round(diasTotal / 365) || 1
  if (frecuencia === '15_Y_FIN_MES') return Math.round(diasTotal / 15) || 1

  const diasPeriodo = DIAS_POR_FRECUENCIA[frecuencia] ?? 30
  return Math.max(1, Math.round(diasTotal / diasPeriodo))
}

/**
 * Genera el calendario completo de cuotas para un crédito recibido.
 *
 * @param {object} credito
 * @param {number}  credito.monto_original      Capital recibido
 * @param {number}  credito.tasa_interes        Tasa periódica (%)
 * @param {string}  credito.tipo_amortizacion   Tipo de amortización
 * @param {string}  credito.frecuencia_pago     Frecuencia
 * @param {string}  credito.fecha_inicio        ISO string
 * @param {string}  credito.fecha_primer_pago   ISO string
 * @param {number}  credito.num_cuotas          (opcional) número fijo de cuotas
 * @returns {Array<object>} Lista de cuotas
 */
export function calcularCuotasCredito(credito) {
  const {
    monto_original,
    tasa_interes,
    tipo_amortizacion,
    frecuencia_pago,
    fecha_inicio,
    fecha_primer_pago,
    num_cuotas: numCuotasFijo
  } = credito

  const capital    = parseFloat(monto_original)
  const tasa       = parseFloat(tasa_interes) / 100
  const tipo       = tipo_amortizacion.toUpperCase()
  const frecuencia = frecuencia_pago.toUpperCase()

  // Determinar número de cuotas
  const n = numCuotasFijo
    ? parseInt(numCuotasFijo)
    : calcularNumCuotas(fecha_inicio, fecha_primer_pago, frecuencia)

  const cuotas = []
  let saldo = capital
  let fechaCuota = new Date(fecha_primer_pago)

  for (let i = 1; i <= n; i++) {
    let interes     = 0
    let principal   = 0
    let cuotaTotal  = 0

    switch (tipo) {
      case 'CUOTA_FIJA': {
        // PMT: cuota fija con amortización francesa
        if (tasa === 0) {
          principal  = capital / n
          interes    = 0
        } else {
          const pmt  = capital * (tasa * Math.pow(1 + tasa, n)) / (Math.pow(1 + tasa, n) - 1)
          interes    = saldo * tasa
          principal  = pmt - interes
        }
        cuotaTotal = interes + Math.min(principal, saldo)
        saldo = Math.max(0, saldo - principal)
        break
      }

      case 'DISMINUIR_CUOTA': {
        // Principal fijo, interés sobre saldo decreciente
        principal  = capital / n
        interes    = saldo * tasa
        cuotaTotal = principal + interes
        saldo = Math.max(0, saldo - principal)
        break
      }

      case 'INTERES_FIJO': {
        // Solo intereses hasta la última cuota, capital al final
        interes    = capital * tasa
        principal  = i === n ? saldo : 0
        cuotaTotal = interes + principal
        if (i === n) saldo = 0
        break
      }

      case 'CAPITAL_AL_FINAL': {
        // Interés flat sobre el capital total, capital solo al final
        interes    = capital * tasa
        principal  = i === n ? saldo : 0
        cuotaTotal = interes + principal
        if (i === n) saldo = 0
        break
      }

      default:
        throw new Error(`Tipo de amortización desconocido: ${tipo}`)
    }

    cuotas.push({
      numero_cuota:    i,
      fecha_vencimiento: new Date(fechaCuota).toISOString().split('T')[0],
      monto_interes:   Math.max(0, parseFloat(interes.toFixed(2))),
      monto_principal: Math.max(0, parseFloat(principal.toFixed(2))),
      monto_total:     Math.max(0, parseFloat(cuotaTotal.toFixed(2))),
      saldo_restante:  Math.max(0, parseFloat(saldo.toFixed(2))),
      estado:          'PENDIENTE', // PENDIENTE | PAGADA | VENCIDA | PARCIAL
    })

    // Avanzar fecha
    fechaCuota = sumarPeriodo(fechaCuota, frecuencia)
  }

  return cuotas
}

/**
 * Calcula el resumen financiero de un crédito antes de guardarlo.
 */
export function calcularResumenCredito(credito) {
  const cuotas = calcularCuotasCredito(credito)
  const totalAPagar = cuotas.reduce((sum, c) => sum + c.monto_total, 0)
  const totalIntereses = cuotas.reduce((sum, c) => sum + c.monto_interes, 0)

  return {
    num_cuotas:       cuotas.length,
    cuota_estimada:   cuotas[0]?.monto_total ?? 0,
    total_a_pagar:    parseFloat(totalAPagar.toFixed(2)),
    total_intereses:  parseFloat(totalIntereses.toFixed(2)),
    cuotas,
  }
}
