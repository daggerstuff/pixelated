export async function triggerTherapyGateSubmit() {
  const fn = (window as any).handleTherapyGateSubmit
  if (typeof fn === 'function') {
    fn()
    return
  }
  const textarea = document.querySelector(
    '[data-testid="message-input"]',
  ) as HTMLTextAreaElement | null
  const chatHistory = document.querySelector(
    '[data-testid="chat-history"]',
  ) as HTMLElement | null
  if (!textarea?.value.trim()) return
  const gateUrl = (window as any).__gateApiUrl || '/api/ingestion/gate'
  const message = textarea.value
  textarea.value = ''
  try {
    const res = await fetch(gateUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: message }] }),
    })
    const data = await res.json()
    if (data.report?.blocked) {
      const blockEl = document.createElement('div')
      blockEl.setAttribute('role', 'alert')
      blockEl.setAttribute('data-testid', 'safety-block')
      blockEl.className =
        'border-red-300 bg-red-50 text-red-900 rounded-lg border px-4 py-3 shadow-sm'
      blockEl.innerHTML = `<p class="font-semibold">Message blocked for safety</p>${data.report.gates?.gate1?.reason ? `<p data-testid="gate-result-reason" class="mt-1 text-sm">${data.report.gates.gate1.reason}</p>` : ''}`
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
        detail: { blocked: data.report?.blocked ?? false, message },
      }),
    )
  } catch {
    window.dispatchEvent(
      new CustomEvent('gate-submit-result', {
        detail: { blocked: false, message, error: true },
      }),
    )
  }
}
