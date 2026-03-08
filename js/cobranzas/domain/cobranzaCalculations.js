/**
 * @fileoverview Domain layer for cobranzas calculations
 * Contains business logic for collection-related calculations
 */

/**
 * Calculate late payment interest (mora)
 * @param {number} originalAmount - Original amount due
 * @param {number} daysLate - Number of days past due date
 * @param {number} interestRate - Daily interest rate (percentage)
 * @returns {number} Total amount with late interest
 */
export const calculateLateInterest = (originalAmount, daysLate, interestRate = 0.1) => {
    if (daysLate <= 0) return originalAmount
    if (interestRate < 0) throw new Error('Interest rate cannot be negative')

    const dailyRate = interestRate / 100
    const interest = originalAmount * dailyRate * daysLate
    return Math.round((originalAmount + interest) * 100) / 100
}

/**
 * Determine collection scale based on days late and amount
 * @param {number} daysLate - Days past due date
 * @param {number} amountDue - Total amount due (including interest)
 * @returns {string} Collection scale ('low', 'medium', 'high', 'critical')
 */
export const determineCollectionScale = (daysLate, amountDue) => {
    if (daysLate <= 0) return 'current'

    // Critical: High amount and very late (>90 days)
    if (daysLate > 90 && amountDue > 10000) return 'critical'

    // High: Very late (>60 days) or high amount (>5000)
    if (daysLate > 60 || amountDue > 5000) return 'high'

    // Medium: Moderately late (30-60 days) or medium amount (1000-5000)
    if (daysLate > 30 || amountDue > 1000) return 'medium'

    // Low: Recently late (<30 days) and low amount
    return 'low'
}

/**
 * Calculate total amount owed including all fees and interest
 * @param {Object} payment - Payment object with due_date and amount
 * @param {Date} currentDate - Current date for calculation
 * @returns {Object} Calculation result
 */
export const calculateTotalOwed = (payment, currentDate = new Date()) => {
    const dueDate = new Date(payment.due_date)
    const daysLate = Math.max(0, Math.floor((currentDate - dueDate) / (1000 * 60 * 60 * 24)))

    const originalAmount = payment.amount || 0
    const lateAmount = calculateLateInterest(originalAmount, daysLate)
    const totalOwed = lateAmount

    return {
        originalAmount,
        lateAmount,
        totalOwed,
        daysLate,
        scale: determineCollectionScale(daysLate, totalOwed)
    }
}

/**
 * Calculate collection effectiveness metrics
 * @param {Array} collectionActions - Array of collection action objects
 * @returns {Object} Effectiveness metrics
 */
export const calculateCollectionEffectiveness = (collectionActions) => {
    if (!Array.isArray(collectionActions) || collectionActions.length === 0) {
        return {
            totalActions: 0,
            resolvedActions: 0,
            effectivenessRate: 0,
            averageResolutionTime: 0
        }
    }

    const resolvedActions = collectionActions.filter(action => action.status === 'resolved')
    const effectivenessRate = (resolvedActions.length / collectionActions.length) * 100

    // Calculate average resolution time in days
    const resolvedWithDates = resolvedActions.filter(action =>
        action.created_at && action.resolved_at
    )

    let averageResolutionTime = 0
    if (resolvedWithDates.length > 0) {
        const totalTime = resolvedWithDates.reduce((sum, action) => {
            const created = new Date(action.created_at)
            const resolved = new Date(action.resolved_at)
            return sum + (resolved - created) / (1000 * 60 * 60 * 24)
        }, 0)
        averageResolutionTime = totalTime / resolvedWithDates.length
    }

    return {
        totalActions: collectionActions.length,
        resolvedActions: resolvedActions.length,
        effectivenessRate: Math.round(effectivenessRate * 100) / 100,
        averageResolutionTime: Math.round(averageResolutionTime * 100) / 100
    }
}

/**
 * Get collection priority score for sorting
 * @param {Object} collectionItem - Collection item with payment data
 * @returns {number} Priority score (higher = more urgent)
 */
export const getCollectionPriority = (collectionItem) => {
    const calc = calculateTotalOwed(collectionItem)

    let priority = 0

    // Base priority by scale
    switch (calc.scale) {
        case 'critical': priority += 100; break
        case 'high': priority += 75; break
        case 'medium': priority += 50; break
        case 'low': priority += 25; break
        default: priority += 0
    }

    // Additional priority by amount
    if (calc.totalOwed > 10000) priority += 20
    else if (calc.totalOwed > 5000) priority += 15
    else if (calc.totalOwed > 1000) priority += 10

    // Additional priority by days late
    if (calc.daysLate > 90) priority += 15
    else if (calc.daysLate > 60) priority += 10
    else if (calc.daysLate > 30) priority += 5

    return priority
}

/**
 * Generate collection reminder message
 * @param {Object} collectionItem - Collection item data
 * @returns {string} Formatted reminder message
 */
export const generateReminderMessage = (collectionItem) => {
    const calc = calculateTotalOwed(collectionItem)

    const messages = {
        critical: `🚨 COBRANZA CRÍTICA: Deuda vencida por ${calc.daysLate} días. Monto total: $${calc.totalOwed.toLocaleString()}. Requiere atención inmediata.`,
        high: `⚠️ COBRANZA ALTA: ${calc.daysLate} días de atraso. Monto: $${calc.totalOwed.toLocaleString()}. Contactar al cliente urgentemente.`,
        medium: `📞 COBRANZA MEDIA: ${calc.daysLate} días atrasados. Monto pendiente: $${calc.totalOwed.toLocaleString()}.`,
        low: `💰 Recordatorio de pago: ${calc.daysLate} días de atraso. Monto: $${calc.totalOwed.toLocaleString()}.`,
        current: `✅ Pago al corriente. Próximo vencimiento en orden.`
    }

    return messages[calc.scale] || messages.low
}
