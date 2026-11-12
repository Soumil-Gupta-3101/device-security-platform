// High-visibility Security Notification Toast for 403 Forbidden and Access Denied events

let toastContainer = null

function getOrCreateContainer() {
  if (typeof document === 'undefined') return null
  if (!toastContainer || !document.body.contains(toastContainer)) {
    toastContainer = document.getElementById('security-toast-container')
    if (!toastContainer) {
      toastContainer = document.createElement('div')
      toastContainer.id = 'security-toast-container'
      toastContainer.className =
        'fixed top-5 right-5 z-[99999] flex flex-col gap-3 max-w-md w-[calc(100vw-2.5rem)] sm:w-96 pointer-events-none font-mono text-xs'
      document.body.appendChild(toastContainer)
    }
  }
  return toastContainer
}

/**
 * Displays a styled 403 Forbidden / Access Denied notification.
 * @param {string} [customMessage] - The error message to display.
 */
export function showForbiddenToast(customMessage) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('api:forbidden', {
        detail: {
          message:
            customMessage || "You don't have permission to perform this action",
        },
      })
    )
  }

  const container = getOrCreateContainer()
  if (!container) return

  const message =
    customMessage || "You don't have permission to perform this action"

  const toast = document.createElement('div')
  toast.className =
    'pointer-events-auto bg-[#0b1324] border border-red-500/80 rounded-lg p-4 shadow-2xl shadow-red-950/60 text-slate-100 transition-all duration-300 transform translate-y-0 opacity-100 flex items-start gap-3 backdrop-blur-md'

  toast.innerHTML = `
    <div class="w-8 h-8 rounded-lg bg-red-950/80 border border-red-500/40 text-red-400 flex items-center justify-center shrink-0 mt-0.5">
      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m0 3.75h.007M10.29 3.86l-7.9 13.68A1.875 1.875 0 004 20.25h16a1.875 1.875 0 001.61-2.71l-7.9-13.68a1.875 1.875 0 00-3.42 0z" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <span class="font-bold text-red-400 uppercase tracking-wider text-[11px]">
          Access Denied (403)
        </span>
        <button class="toast-close text-slate-400 hover:text-white transition-colors p-0.5">
          <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <p class="text-xs text-slate-300 mt-1 leading-relaxed font-sans">
        ${message}
      </p>
    </div>
  `

  const removeToast = () => {
    toast.classList.add('opacity-0', 'translate-y-[-8px]')
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast)
      }
    }, 300)
  }

  const closeBtn = toast.querySelector('.toast-close')
  if (closeBtn) {
    closeBtn.addEventListener('click', removeToast)
  }

  // Auto-remove after 5 seconds
  const timer = setTimeout(removeToast, 5000)

  toast.addEventListener('mouseenter', () => clearTimeout(timer))
  toast.addEventListener('mouseleave', () => setTimeout(removeToast, 2500))

  container.appendChild(toast)
}

export default {
  showForbiddenToast,
}

