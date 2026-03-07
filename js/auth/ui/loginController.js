import { DOM_IDS } from '../../app/ui/domIds.js'
import { CSS_CLASSES } from '../../app/ui/cssClasses.js'
import { getValue, show, hide, showError, clearError, setButtonLoading, clearButtonLoading, setText } from '../../app/ui/domAdapter.js'
import { bindEvent } from '../../app/ui/domEvents.js'
import { login, register } from '../../adapters/supabaseAuth.js'
import { ACTION_TYPES } from '../../app/state/actions.js'
import { isRequired, isValidEmail, minLength } from '../../common/validators.js'
import { translateAuthError } from '../../common/errorMessages.js'

/**
 * loginController — Maneja la pantalla de login/registro.
 * Flujo: form submit → validar → supabaseAuth → dispatch → appController navega.
 *
 * @param {object} store
 */
export function initLoginController(store) {
  let isRegisterMode = false

  // ── Toggle modo login ↔ registro ─────────────────────────────────────
  bindEvent(DOM_IDS.REGISTER_TOGGLE, 'click', () => {
    isRegisterMode = !isRegisterMode
    _updateFormMode(isRegisterMode)
  })

  // ── Form submit ───────────────────────────────────────────────────────
  bindEvent(DOM_IDS.LOGIN_FORM, 'submit', async (e) => {
    e.preventDefault()
    clearError(DOM_IDS.LOGIN_ERROR)

    const email    = getValue(DOM_IDS.LOGIN_EMAIL)
    const password = getValue(DOM_IDS.LOGIN_PASSWORD)
    const name     = getValue(DOM_IDS.LOGIN_NAME)

    // Validaciones
    const error = _validate({ email, password, name, isRegisterMode })
    if (error) {
      showError(DOM_IDS.LOGIN_ERROR, error)
      return
    }

    setButtonLoading(DOM_IDS.LOGIN_SUBMIT)

    try {
      if (isRegisterMode) {
        await register(email, password)
        // Supabase puede requerir confirmación de email
        showError(DOM_IDS.LOGIN_ERROR, '')
        _showRegistroExitoso()
      } else {
        const { user } = await login(email, password)
        // El onAuthStateChange en appController manejará la navegación
        store.dispatch({ type: ACTION_TYPES.SET_SESSION, payload: { user } })
      }
    } catch (err) {
      const msg = translateAuthError(err?.message ?? '')
      showError(DOM_IDS.LOGIN_ERROR, msg)
    } finally {
      clearButtonLoading(DOM_IDS.LOGIN_SUBMIT)
    }
  })

  // ── Limpiar error al escribir ─────────────────────────────────────────
  bindEvent(DOM_IDS.LOGIN_EMAIL, 'input', () => clearError(DOM_IDS.LOGIN_ERROR))
  bindEvent(DOM_IDS.LOGIN_PASSWORD, 'input', () => clearError(DOM_IDS.LOGIN_ERROR))
}

// ── Internos ───────────────────────────────────────────────────────────────

function _validate({ email, password, name, isRegisterMode }) {
  const emailCheck = isValidEmail(email)
  if (!email) return 'El correo electrónico es obligatorio.'
  if (!emailCheck.valid) return emailCheck.error

  const passCheck = minLength(password, 6, 'La contraseña')
  if (!password) return 'La contraseña es obligatoria.'
  if (!passCheck.valid) return passCheck.error

  if (isRegisterMode) {
    const nameCheck = isRequired(name, 'El nombre')
    if (!nameCheck.valid) return nameCheck.error
  }

  return null
}

function _updateFormMode(isRegister) {
  const submitBtn      = document.getElementById(DOM_IDS.LOGIN_SUBMIT)
  const toggleBtn      = document.getElementById(DOM_IDS.REGISTER_TOGGLE)
  const nameGroup      = document.getElementById(DOM_IDS.REGISTER_NAME_GROUP)
  const passwordInput  = document.getElementById(DOM_IDS.LOGIN_PASSWORD)

  if (isRegister) {
    nameGroup.classList.remove(CSS_CLASSES.HIDDEN)
    submitBtn.textContent = 'Crear cuenta'
    toggleBtn.innerHTML = '¿Ya tienes cuenta? <strong>Inicia sesión</strong>'
    passwordInput.setAttribute('autocomplete', 'new-password')
  } else {
    nameGroup.classList.add(CSS_CLASSES.HIDDEN)
    submitBtn.textContent = 'Iniciar sesión'
    toggleBtn.innerHTML = '¿No tienes cuenta? <strong>Regístrate gratis</strong>'
    passwordInput.setAttribute('autocomplete', 'current-password')
  }

  // Limpiar estado del form al cambiar modo
  document.getElementById(DOM_IDS.LOGIN_FORM).reset()
  const errorEl = document.getElementById(DOM_IDS.LOGIN_ERROR)
  if (errorEl) {
    errorEl.textContent = ''
    errorEl.classList.add(CSS_CLASSES.HIDDEN)
  }
}

function _showRegistroExitoso() {
  const errorEl = document.getElementById(DOM_IDS.LOGIN_ERROR)
  if (errorEl) {
    errorEl.textContent = 'Cuenta creada. Revisa tu correo para confirmar tu cuenta.'
    errorEl.style.background = 'var(--color-success-light)'
    errorEl.style.color = 'var(--color-success-text)'
    errorEl.style.borderLeftColor = 'var(--color-success)'
    errorEl.classList.remove(CSS_CLASSES.HIDDEN)
  }
}
