export async function triggerTherapyGateSubmit() {
  const fn = (window as typeof window & { handleTherapyGateSubmit?: () => void }).handleTherapyGateSubmit
  if (typeof fn === 'function') {
    await fn()
    return
  }
  const textarea = document.querySelector(
    '[data-testid="message-input"]',
  ) as HTMLTextAreaElement | null
  const chatHistory = document.querySelector(
    '[data-testid="chat-history"]',
  ) as HTMLElement | null
  if (!textarea?.value.trim()) return
  const gateUrl = (window as typeof window & { gateApiUrl?: string }).gateApiUrl ?? '/api/ingestion/gate'
  const message = textarea.value
  textarea.value = ''
  try {
    const res = await fetch(gateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content: message,
        source_id: `chat-${Date.now()}`,
      }),
    })
    if (!res.ok) {
      throw new Error(`Gate API returned ${res.status}`)
    }
    const data = await res.json()
    const blocked = Boolean(data.report?.blocked ?? data.accepted === false)
    if (blocked) {
      const blockEl = document.createElement('div')
      blockEl.setAttribute('role', 'alert')
      blockEl.setAttribute('data-testid', 'safety-block')
      blockEl.className =
        'border-red-300 bg-red-50 text-red-900 rounded-lg border px-4 py-3 shadow-sm'
      const title = document.createElement('p')
      title.className = 'font-semibold'
      title.textContent = 'Message blocked for safety'
      blockEl.appendChild(title)
      const reason = data.report?.gates?.gate1?.reason
      if (typeof reason === 'string' && reason.length > 0) {
        const reasonEl = document.createElement('p')
        reasonEl.setAttribute('data-testid', 'gate-result-reason')
        reasonEl.className = 'mt-1 text-sm'
        reasonEl.textContent = reason
        blockEl.appendChild(reasonEl)
      }
      chatHistory?.appendChild(blockEl)
    } else {
      const msgEl = document.createElement('div')
      msgEl.setAttribute('data-testid', 'message-user')
      msgEl.className =
        'max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-blue-600 text-white ml-auto'
      msgEl.textContent = message
      chatHistory?.appendChild(msgEl)
    }
    window.dispatchEvent(
      new CustomEvent('gate-submit-result', {
        detail: { blocked, message },
      }),
    )
  } catch {
    window.dispatchEvent(
      new CustomEvent('gate-submit-result', {
        detail: { blocked: true, message, error: true },
      }),
    )
  }
}
