/**
 * reportesDataAdapter.js - Capa de datos para el módulo de Reportes.
 *
 * Usa las vistas y funciones creadas en la migración 001_add_report_views.sql.
 * Todas las queries usan RLS de Supabase (user_id automático).
 */

import { supabaseClient } from '../supabaseClient.js'

export const reportesDataAdapter = {

  // ──────────────────────────────────────────────────────────────
  // REPORTE 1: CARTERA ACTIVA
  // Usa la vista vw_resumen_cartera + detalle de préstamos activos
  // ──────────────────────────────────────────────────────────────

  /**
   * KPIs globales de la cartera.
   */
  getResumenCartera: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    // maybeSingle() devuelve null si no hay filas (usuario sin préstamos aún)
    // .single() lanza 406 / PGRST116 cuando la vista devuelve 0 filas
    const { data, error } = await supabaseClient
      .from('vw_resumen_cartera')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  },

  /**
   * Préstamos activos con datos del cliente, para la tabla del reporte.
   */
  getPrestamosActivos: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { data, error } = await supabaseClient
      .from('prestamos')
      .select(`
        id,
        monto_original,
        monto_pagado,
        saldo_pendiente,
        interes_pendiente,
        tasa_interes,
        estado,
        fecha_inicio,
        fecha_fin,
        clientes ( nombre, nivel_riesgo )
      `)
      .eq('user_id', user.id)
      .eq('estado', 'ACTIVO')
      .order('saldo_pendiente', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  // ──────────────────────────────────────────────────────────────
  // REPORTE 2: COBROS DEL PERÍODO
  // Usa la función RPC fn_cobros_por_periodo
  // ──────────────────────────────────────────────────────────────

  /**
   * Pagos en un rango de fechas.
   * @param {string} desde - YYYY-MM-DD
   * @param {string} hasta - YYYY-MM-DD
   */
  getCobrosDelPeriodo: async (desde, hasta) => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { data, error } = await supabaseClient.rpc('fn_cobros_por_periodo', {
      p_user_id: user.id,
      p_desde: desde,
      p_hasta: hasta
    })

    if (error) throw error
    return data ?? []
  },

  // ──────────────────────────────────────────────────────────────
  // REPORTE 3: MOROSIDAD
  // Usa la vista vw_morosidad_detalle
  // ──────────────────────────────────────────────────────────────

  /**
   * Cuotas vencidas con detalle de cliente y segmento de mora.
   */
  getMorosidad: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { data, error } = await supabaseClient
      .from('vw_morosidad_detalle')
      .select('*')
      .eq('user_id', user.id)
      .order('dias_atraso', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  // ──────────────────────────────────────────────────────────────
  // REPORTE 4: ACTIVOS
  // Query directa a la tabla activos
  // ──────────────────────────────────────────────────────────────

  /**
   * Todos los activos con sus métricas financieras.
   */
  getActivos: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { data, error } = await supabaseClient
      .from('activos')
      .select(`
        id, nombre, categoria, estado,
        costo_compra, precio_venta_final, ganancia, margen_porcentaje,
        fecha_compra, fecha_venta
      `)
      .eq('user_id', user.id)
      .order('fecha_compra', { ascending: false })

    if (error) throw error
    return data ?? []
  },

  // ──────────────────────────────────────────────────────────────
  // REPORTE 5: RENTABILIDAD GLOBAL
  // Usa fn_rentabilidad_mensual + vw_rentabilidad_acumulada
  // ──────────────────────────────────────────────────────────────

  /**
   * Rentabilidad por mes (últimos N meses).
   * @param {number} meses - default 12
   */
  getRentabilidadMensual: async (meses = 12) => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    const { data, error } = await supabaseClient.rpc('fn_rentabilidad_mensual', {
      p_user_id: user.id,
      p_meses: meses
    })

    if (error) throw error
    return data ?? []
  },

  /**
   * Totales acumulados de rentabilidad (interés + activos).
   */
  getRentabilidadAcumulada: async () => {
    const { data: { user } } = await supabaseClient.auth.getUser()
    if (!user) throw new Error('No autorizado')

    // maybeSingle() para manejar usuario sin activos/pagos aún (0 filas)
    const { data, error } = await supabaseClient
      .from('vw_rentabilidad_acumulada')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) throw error
    return data ?? null
  }
}
