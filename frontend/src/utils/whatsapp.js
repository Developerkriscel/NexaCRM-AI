import { commsAPI } from '../services/api'

/** Send a WhatsApp text message */
export async function sendWhatsApp(number, message) {
  const clean = String(number).replace(/\D/g, '')
  if (!clean) throw new Error('Invalid phone number')
  return commsAPI.sendChannel({
    channel: 'whatsapp',
    recipient: clean,
    body: message,
  })
}

/**
 * Fetch incoming messages — the inbox is delivered via a backend webhook.
 * This function is a no-op stub so the UI degrades gracefully when inbox sync
 * is not available in the browser.
 */
export async function fetchWhatsAppMessages(_number) {
  // Return empty — browsers cannot poll the inbox directly, so this stays webhook-backed.
  // Wire up a backend receiver to push incoming messages into this app.
  return []
}

export const WA_CONFIGURED = true
