/**
 * @fileoverview Domain layer for cobranzas validation
 * Contains business rules and validation logic for collections
 */

/**
 * Collection status types
 */
export const COLLECTION_STATUS = {
    PENDING: 'pending',
    IN_PROGRESS: 'in_progress',
    CONTACTED: 'contacted',
    NEGOTIATED: 'negotiated',
    RESOLVED: 'resolved',
    CANCELLED: 'cancelled',
    LEGAL: 'legal'
}

/**
 * Collection action types
 */
export const COLLECTION_ACTION_TYPES = {
    PHONE_CALL: 'phone_call',
    EMAIL: 'email',
    SMS: 'sms',
    LETTER: 'letter',
    VISIT: 'visit',
    PAYMENT_PLAN: 'payment_plan',
    SETTLEMENT: 'settlement',
    LEGAL_NOTICE: 'legal_notice',
    OTHER: 'other'
}

/**
 * Validate collection status transition
 * @param {string} currentStatus - Current collection status
 * @param {string} newStatus - New status to transition to
 * @returns {Object} Validation result {isValid, error}
 */
export const validateStatusTransition = (currentStatus, newStatus) => {
    const validTransitions = {
        [COLLECTION_STATUS.PENDING]: [
            COLLECTION_STATUS.IN_PROGRESS,
            COLLECTION_STATUS.CANCELLED
        ],
        [COLLECTION_STATUS.IN_PROGRESS]: [
            COLLECTION_STATUS.CONTACTED,
            COLLECTION_STATUS.PENDING,
            COLLECTION_STATUS.CANCELLED
        ],
        [COLLECTION_STATUS.CONTACTED]: [
            COLLECTION_STATUS.NEGOTIATED,
            COLLECTION_STATUS.IN_PROGRESS,
            COLLECTION_STATUS.RESOLVED,
            COLLECTION_STATUS.CANCELLED
        ],
        [COLLECTION_STATUS.NEGOTIATED]: [
            COLLECTION_STATUS.RESOLVED,
            COLLECTION_STATUS.CONTACTED,
            COLLECTION_STATUS.LEGAL,
            COLLECTION_STATUS.CANCELLED
        ],
        [COLLECTION_STATUS.RESOLVED]: [], // Final state
        [COLLECTION_STATUS.CANCELLED]: [], // Final state
        [COLLECTION_STATUS.LEGAL]: [
            COLLECTION_STATUS.RESOLVED,
            COLLECTION_STATUS.CANCELLED
        ]
    }

    if (!validTransitions[currentStatus]) {
        return {
            isValid: false,
            error: `Invalid current status: ${currentStatus}`
        }
    }

    if (!validTransitions[currentStatus].includes(newStatus)) {
        return {
            isValid: false,
            error: `Cannot transition from ${currentStatus} to ${newStatus}`
        }
    }

    return { isValid: true }
}

/**
 * Validate collection action data
 * @param {Object} actionData - Action data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
export const validateCollectionAction = (actionData) => {
    const errors = []

    if (!actionData) {
        return { isValid: false, errors: ['Action data is required'] }
    }

    // Validate required fields
    if (!actionData.collection_id) {
        errors.push('Collection ID is required')
    }

    if (!actionData.action_type || !Object.values(COLLECTION_ACTION_TYPES).includes(actionData.action_type)) {
        errors.push('Valid action type is required')
    }

    if (!actionData.description || actionData.description.trim().length < 10) {
        errors.push('Description must be at least 10 characters long')
    }

    // Validate dates
    if (actionData.action_date) {
        const actionDate = new Date(actionData.action_date)
        if (isNaN(actionDate.getTime())) {
            errors.push('Invalid action date format')
        } else if (actionDate > new Date()) {
            errors.push('Action date cannot be in the future')
        }
    }

    // Validate contact result if provided
    if (actionData.contact_result && typeof actionData.contact_result !== 'string') {
        errors.push('Contact result must be a string')
    }

    // Validate follow_up_date if provided
    if (actionData.follow_up_date) {
        const followUpDate = new Date(actionData.follow_up_date)
        if (isNaN(followUpDate.getTime())) {
            errors.push('Invalid follow-up date format')
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

/**
 * Validate collection item data
 * @param {Object} collectionData - Collection data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
export const validateCollectionData = (collectionData) => {
    const errors = []

    if (!collectionData) {
        return { isValid: false, errors: ['Collection data is required'] }
    }

    // Validate required fields
    if (!collectionData.payment_id) {
        errors.push('Payment ID is required')
    }

    if (!collectionData.client_id) {
        errors.push('Client ID is required')
    }

    if (!collectionData.prestamo_id) {
        errors.push('Prestamo ID is required')
    }

    // Validate status
    if (!collectionData.status || !Object.values(COLLECTION_STATUS).includes(collectionData.status)) {
        errors.push('Valid collection status is required')
    }

    // Validate amounts
    if (typeof collectionData.amount_due !== 'number' || collectionData.amount_due < 0) {
        errors.push('Valid amount due is required (must be non-negative number)')
    }

    // Validate dates
    if (!collectionData.created_at) {
        collectionData.created_at = new Date().toISOString()
    }

    if (collectionData.due_date) {
        const dueDate = new Date(collectionData.due_date)
        if (isNaN(dueDate.getTime())) {
            errors.push('Invalid due date format')
        }
    }

    if (collectionData.last_contact_date) {
        const lastContactDate = new Date(collectionData.last_contact_date)
        if (isNaN(lastContactDate.getTime())) {
            errors.push('Invalid last contact date format')
        }
    }

    // Validate priority if provided
    if (collectionData.priority !== undefined) {
        if (typeof collectionData.priority !== 'number' || collectionData.priority < 0 || collectionData.priority > 200) {
            errors.push('Priority must be a number between 0 and 200')
        }
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

/**
 * Validate payment plan data
 * @param {Object} paymentPlanData - Payment plan data to validate
 * @returns {Object} Validation result {isValid, errors}
 */
export const validatePaymentPlan = (paymentPlanData) => {
    const errors = []

    if (!paymentPlanData) {
        return { isValid: false, errors: ['Payment plan data is required'] }
    }

    // Validate required fields
    if (!paymentPlanData.collection_id) {
        errors.push('Collection ID is required')
    }

    if (!paymentPlanData.total_amount || typeof paymentPlanData.total_amount !== 'number' || paymentPlanData.total_amount <= 0) {
        errors.push('Valid total amount is required')
    }

    if (!paymentPlanData.installments || !Array.isArray(paymentPlanData.installments) || paymentPlanData.installments.length === 0) {
        errors.push('At least one installment is required')
    }

    // Validate installments
    let totalInstallmentAmount = 0
    paymentPlanData.installments.forEach((installment, index) => {
        if (!installment.amount || typeof installment.amount !== 'number' || installment.amount <= 0) {
            errors.push(`Installment ${index + 1}: valid amount is required`)
        }

        if (!installment.due_date) {
            errors.push(`Installment ${index + 1}: due date is required`)
        } else {
            const dueDate = new Date(installment.due_date)
            if (isNaN(dueDate.getTime())) {
                errors.push(`Installment ${index + 1}: invalid due date format`)
            }
        }

        totalInstallmentAmount += installment.amount || 0
    })

    // Check if installment amounts sum to total
    const tolerance = 0.01 // Allow for rounding differences
    if (Math.abs(totalInstallmentAmount - paymentPlanData.total_amount) > tolerance) {
        errors.push('Sum of installment amounts must equal total amount')
    }

    return {
        isValid: errors.length === 0,
        errors
    }
}

/**
 * Check if collection item can be escalated
 * @param {Object} collectionItem - Collection item data
 * @returns {boolean} Whether escalation is allowed
 */
export const canEscalateCollection = (collectionItem) => {
    if (!collectionItem) return false

    const daysSinceLastAction = collectionItem.last_action_date
        ? Math.floor((new Date() - new Date(collectionItem.last_action_date)) / (1000 * 60 * 60 * 24))
        : Infinity

    // Can escalate if:
    // - Status is not resolved or cancelled
    // - Has been at least 7 days since last action
    // - Amount due is significant (>100)
    return collectionItem.status !== COLLECTION_STATUS.RESOLVED &&
           collectionItem.status !== COLLECTION_STATUS.CANCELLED &&
           daysSinceLastAction >= 7 &&
           collectionItem.amount_due > 100
}

/**
 * Get allowed actions for current collection status
 * @param {string} status - Current collection status
 * @returns {Array} Array of allowed action types
 */
export const getAllowedActions = (status) => {
    const actionMatrix = {
        [COLLECTION_STATUS.PENDING]: [COLLECTION_ACTION_TYPES.PHONE_CALL, COLLECTION_ACTION_TYPES.EMAIL],
        [COLLECTION_STATUS.IN_PROGRESS]: [COLLECTION_ACTION_TYPES.PHONE_CALL, COLLECTION_ACTION_TYPES.EMAIL, COLLECTION_ACTION_TYPES.SMS],
        [COLLECTION_STATUS.CONTACTED]: [COLLECTION_ACTION_TYPES.PHONE_CALL, COLLECTION_ACTION_TYPES.EMAIL, COLLECTION_ACTION_TYPES.SMS, COLLECTION_ACTION_TYPES.VISIT],
        [COLLECTION_STATUS.NEGOTIATED]: [COLLECTION_ACTION_TYPES.PHONE_CALL, COLLECTION_ACTION_TYPES.EMAIL, COLLECTION_ACTION_TYPES.PAYMENT_PLAN, COLLECTION_ACTION_TYPES.SETTLEMENT],
        [COLLECTION_STATUS.LEGAL]: [COLLECTION_ACTION_TYPES.LEGAL_NOTICE, COLLECTION_ACTION_TYPES.PHONE_CALL],
        [COLLECTION_STATUS.RESOLVED]: [],
        [COLLECTION_STATUS.CANCELLED]: []
    }

    return actionMatrix[status] || []
}
