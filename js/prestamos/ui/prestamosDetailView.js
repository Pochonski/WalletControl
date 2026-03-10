/**
 * prestamosDetailView.js
 * Renderizado de la vista de detalle de un préstamo.
 * Funciones puras de presentación: reciben datos, retornan HTML o mutaciones mínimas.
 */

import { formatDate } from '../../common/dateUtils.js'

// ─────────────────────────────────────────────────────────────────────────────
// FORMATEO
// ─────────────────────────────────────────────────────────────────────────────
const fmtCRC = (n) =>
    new Intl.NumberFormat('es-CR', { style: 'currency', currency: 'CRC' }).format(n || 0)

const badgeClass = {
    ACTIVO: 'badge--primary',
    PAGADO: 'badge--success',
    COMPLETADO: 'badge--success',
    MORA: 'badge--danger',
    VENCIDA: 'badge--danger',
    ARCHIVADO: 'badge--secondary',
    PENDIENTE: 'badge--warning',
    PAGADA: 'badge--success',
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. BARRA DE PROGRESO
// ─────────────────────────────────────────────────────────────────────────────
function renderProgreso(prestamo, cuotas) {
    const total = cuotas.length
    if (total === 0) return ''

    const pagadas = cuotas.filter(c => c.estado === 'PAGADA').length
    const pct = Math.round((pagadas / total) * 100)

    const montoPagado = prestamo.monto_pagado || 0
    const montoOriginal = prestamo.monto_original || 0
    const pctMonto = montoOriginal > 0
        ? Math.min(100, Math.round((montoPagado / montoOriginal) * 100))
        : pct

    return `
    <div class="progress-section" style="padding: 0 16px 16px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-size: 0.78rem; color: var(--color-text-light);">${pagadas} de ${total} cuotas pagadas</span>
        <span style="font-size: 0.78rem; font-weight: 700; color: var(--color-primary);">${pct}%</span>
      </div>
      <div style="height: 8px; background: var(--color-border-light, #e5e7eb); border-radius: 999px; overflow: hidden;">
        <div style="height: 100%; width: ${pct}%; background: linear-gradient(90deg, var(--color-primary), var(--color-secondary, #4f46e5)); border-radius: 999px; transition: width 0.4s ease;"></div>
      </div>
      ${pctMonto !== pct ? `
      <div style="display: flex; justify-content: space-between; margin-top: 6px;">
        <span style="font-size: 0.72rem; color: var(--color-text-light);">Capital pagado</span>
        <span style="font-size: 0.72rem; font-weight: 600;">${fmtCRC(montoPagado)} / ${fmtCRC(montoOriginal)}</span>
      </div>` : ''}
    </div>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. RESUMEN FINANCIERO
// ─────────────────────────────────────────────────────────────────────────────
function renderResumenFinanciero(prestamo, cuotas) {
    const saldo = prestamo.saldo_pendiente ?? prestamo.monto_original
    const totalPagado = prestamo.monto_pagado || 0
    const totalConInteres = prestamo.total_con_interes || prestamo.monto_original

    // Calcular interés total desde cuotas si no viene en el préstamo
    const interesTotalCuotas = cuotas.reduce((sum, c) => sum + (c.interes_aplicable || 0), 0)

    return `
    <h3 class="detail-section-title">Resumen Financiero</h3>
    <div class="detail-grid">
      <div class="detail-card">
        <span class="detail-label">Monto Aprobado</span>
        <span class="detail-value" style="color: var(--color-primary); font-weight: 700;">${fmtCRC(prestamo.monto_original)}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Interés total (${prestamo.tasa_interes}% ${prestamo.frecuencia_pago?.toLowerCase()})</span>
        <span class="detail-value">${fmtCRC(interesTotalCuotas)}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Total a pagar</span>
        <span class="detail-value" style="font-weight: 700;">${fmtCRC(totalConInteres || (prestamo.monto_original + interesTotalCuotas))}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Saldo pendiente</span>
        <span class="detail-value" style="color: var(--color-danger);">${fmtCRC(saldo)}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Ya pagado</span>
        <span class="detail-value" style="color: var(--color-success, #16a34a);">${fmtCRC(totalPagado)}</span>
      </div>
      <div class="detail-card">
        <span class="detail-label">Frecuencia</span>
        <span class="detail-value">${prestamo.frecuencia_pago || '—'}</span>
      </div>
    </div>
  `
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. TABLA DE CUOTAS
// ─────────────────────────────────────────────────────────────────────────────
function renderTablaCuotas(cuotas) {
    if (cuotas.length === 0) {
        return `<tr><td colspan="5" style="text-align:center; padding: 20px; color: var(--color-text-light);">No hay cuotas generadas</td></tr>`
    }

    return cuotas.map(c => {
        const cls = badgeClass[c.estado] || 'badge--secondary'
        const fmtMonto = fmtCRC(c.monto_total)
        const esPendiente = c.estado === 'PENDIENTE'
        const esVencida = esPendiente && c.fecha_vencimiento < new Date().toISOString().split('T')[0]

        return `
      <tr style="border-bottom: 1px solid var(--color-border-light);"
          class="${esVencida ? 'row-overdue' : ''}">
        <td style="padding: 10px 12px;">${c.numero_cuota}</td>
        <td style="padding: 10px 12px; font-size: 0.85rem;">${formatDate(c.fecha_vencimiento, 'short')}</td>
        <td style="padding: 10px 12px; text-align: right; font-weight: 600;">${fmtMonto}</td>
        <td style="padding: 10px 12px; text-align: center;">
          <span class="badge ${cls}" style="font-size: 0.65rem;">
            ${esVencida ? 'VENCIDA' : c.estado}
          </span>
        </td>
        <td style="padding: 10px 12px; text-align: center;">
          ${esPendiente
                ? `<button class="btn btn-sm btn-ghost btn-pagar" data-id="${c.id}" data-monto="${c.monto_total}">Pagar</button>`
                : '—'}
        </td>
      </tr>`
    }).join('')
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. MODAL DE AMORTIZACIÓN
// ─────────────────────────────────────────────────────────────────────────────
export function mostrarTablaAmortizacion(prestamo, cuotas) {
    const existing = document.getElementById('modal-amortizacion')
    if (existing) existing.remove()

    const modal = document.createElement('div')
    modal.id = 'modal-amortizacion'
    modal.style.cssText = `
    position: fixed; inset: 0; z-index: 999;
    background: rgba(0,0,0,0.5); display: flex; align-items: flex-end;
  `

    const filas = cuotas.map(c => {
        const cls = badgeClass[c.estado] || 'badge--secondary'
        return `
      <tr style="border-bottom: 1px solid var(--color-border-light, #f3f4f6);">
        <td style="padding: 8px 10px; font-size: 0.78rem;">${c.numero_cuota}</td>
        <td style="padding: 8px 10px; font-size: 0.78rem;">${formatDate(c.fecha_vencimiento, 'short')}</td>
        <td style="padding: 8px 10px; font-size: 0.78rem; text-align: right;">${fmtCRC(c.monto_original || 0)}</td>
        <td style="padding: 8px 10px; font-size: 0.78rem; text-align: right;">${fmtCRC(c.interes_aplicable || 0)}</td>
        <td style="padding: 8px 10px; font-size: 0.78rem; text-align: right; font-weight: 600;">${fmtCRC(c.monto_total)}</td>
        <td style="padding: 8px 10px; text-align: center;"><span class="badge ${cls}" style="font-size: 0.6rem;">${c.estado}</span></td>
      </tr>`
    }).join('')

    const totalInteres = cuotas.reduce((s, c) => s + (c.interes_aplicable || 0), 0)
    const totalPagar = cuotas.reduce((s, c) => s + (c.monto_total || 0), 0)

    modal.innerHTML = `
    <div style="background: var(--color-surface); border-radius: 20px 20px 0 0; width: 100%; max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;">
      <div style="padding: 16px 20px; border-bottom: 1px solid var(--color-border-light); display: flex; justify-content: space-between; align-items: center;">
        <h3 style="font-size: 1rem; font-weight: 700; margin: 0;">Tabla de Amortización</h3>
        <button id="close-amortizacion" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: var(--color-text-light);">✕</button>
      </div>
      <div style="padding: 12px 20px; background: var(--color-surface-alt, #f9fafb); border-bottom: 1px solid var(--color-border-light); display: flex; gap: 24px;">
        <div><span style="font-size: 0.72rem; color: var(--color-text-light);">Capital</span><br><strong>${fmtCRC(prestamo.monto_original)}</strong></div>
        <div><span style="font-size: 0.72rem; color: var(--color-text-light);">Interés total</span><br><strong>${fmtCRC(totalInteres)}</strong></div>
        <div><span style="font-size: 0.72rem; color: var(--color-text-light);">Total a pagar</span><br><strong>${fmtCRC(totalPagar)}</strong></div>
      </div>
      <div style="overflow-y: auto; flex: 1;">
        <table style="width: 100%; border-collapse: collapse;">
          <thead style="background: var(--color-surface-alt, #f9fafb); position: sticky; top: 0; z-index: 1;">
            <tr>
              <th style="padding: 8px 10px; text-align: left; font-size: 0.75rem;">#</th>
              <th style="padding: 8px 10px; text-align: left; font-size: 0.75rem;">Vence</th>
              <th style="padding: 8px 10px; text-align: right; font-size: 0.75rem;">Capital</th>
              <th style="padding: 8px 10px; text-align: right; font-size: 0.75rem;">Interés</th>
              <th style="padding: 8px 10px; text-align: right; font-size: 0.75rem;">Total</th>
              <th style="padding: 8px 10px; text-align: center; font-size: 0.75rem;">Estado</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    </div>
  `

    document.body.appendChild(modal)
    modal.querySelector('#close-amortizacion').onclick = () => modal.remove()
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove() })
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. RENDER PRINCIPAL DEL DETALLE
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza la vista completa de detalle de un préstamo.
 * @param {object}   prestamo
 * @param {object[]} cuotas
 * @param {string}   nombreCliente
 * @param {object}   callbacks  - { onBack, onPagar(cuotaId, montoCuota), onAmortizacion }
 */
export function renderDetallePrestamo(prestamo, cuotas, nombreCliente, callbacks) {
    const detailView = document.getElementById('view-prestamo-detail')
    if (!detailView) return

    const estadoCls = badgeClass[prestamo.estado] || 'badge--primary'

    detailView.innerHTML = `
    <div class="detail-header">
      <button class="btn-back-circle" id="btn-prestamo-detail-back">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <span class="detail-label">Detalle del Préstamo</span>
    </div>

    <div class="detail-profile">
      <div class="avatar-large" style="background: var(--color-primary-light); color: var(--color-primary);">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="2" y="6" width="20" height="12" rx="2"/>
          <circle cx="12" cy="12" r="2"/>
          <path d="M6 12h.01M18 12h.01"/>
        </svg>
      </div>
      <h2 class="detail-name">${nombreCliente}</h2>
      <span class="badge ${estadoCls}">${prestamo.estado || 'ACTIVO'}</span>
      <div style="font-size: 0.75rem; color: var(--color-text-light); margin-top: 4px;">
        ${prestamo.tipo_interes || ''} · Cuotas: ${cuotas.length}
      </div>
    </div>

    ${renderProgreso(prestamo, cuotas)}
    ${renderResumenFinanciero(prestamo, cuotas)}

    <h3 class="detail-section-title">Plan de Pagos / Cuotas</h3>
    <div class="table-container" style="background: var(--color-surface); border-radius: 12px; margin: 0 16px; overflow: hidden; box-shadow: var(--shadow-sm);">
      <table class="data-table" style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
        <thead style="background: rgba(0,0,0,0.02); border-bottom: 1px solid var(--color-border);">
          <tr>
            <th style="padding: 12px;">No.</th>
            <th style="padding: 12px; text-align: left;">Vencimiento</th>
            <th style="padding: 12px; text-align: right;">Monto</th>
            <th style="padding: 12px; text-align: center;">Estado</th>
            <th style="padding: 12px; text-align: center;">Acción</th>
          </tr>
        </thead>
        <tbody>${renderTablaCuotas(cuotas)}</tbody>
      </table>
    </div>

    <div class="detail-actions-bar" style="padding: 24px 16px 40px 16px;">
      <button class="btn btn-primary btn-full" id="btn-amortizacion">Ver Tabla de Amortización</button>
    </div>
  `

    // ── Event listeners ────────────────────────────────────────────────
    detailView.querySelector('#btn-prestamo-detail-back').onclick = callbacks.onBack
    detailView.querySelector('#btn-amortizacion').onclick = () =>
        mostrarTablaAmortizacion(prestamo, cuotas)

    // Bind botones de pago
    detailView.querySelectorAll('.btn-pagar').forEach(btn => {
        btn.onclick = async () => {
            const cuotaId = btn.dataset.id
            const montoCuota = parseFloat(btn.dataset.monto) || 0
            await callbacks.onPagar(cuotaId, montoCuota, prestamo, cuotas, nombreCliente)
        }
    })
}
