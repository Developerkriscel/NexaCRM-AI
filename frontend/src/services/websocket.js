/**
 * WebSocket service using STOMP over SockJS
 * Connects to Spring Boot WebSocket endpoint for real-time notifications
 */
import SockJS from 'sockjs-client'
import StompModule from 'stompjs/lib/stomp.js'
import { useAuthStore } from '../store/authStore'

const Stomp = StompModule?.Stomp ?? StompModule
let reconnectAttempts = 0

function normalizeSockJsUrl(input) {
  const raw = String(input ?? '').trim()
  if (!raw) return ''

  const normalizedPrefix = raw
    .replace(/^wss:/i, 'https:')
    .replace(/^ws:/i, 'http:')

  try {
    const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost'
    const url = new URL(normalizedPrefix, base)
    if (url.protocol === 'ws:') url.protocol = 'http:'
    if (url.protocol === 'wss:') url.protocol = 'https:'
    return url.toString().replace(/\/$/, '')
  } catch {
    return normalizedPrefix
  }
}

const normalizeJwtToken = (token) => {
  if (typeof token !== 'string') return null
  const trimmed = token.trim()
  if (!trimmed) return null
  const raw = trimmed.toLowerCase().startsWith('bearer ') ? trimmed.slice(7).trim() : trimmed
  if (raw.split('.').length === 3 && !raw.includes(' ')) return raw
  return null
}

let stompClient = null
const subscriptions = new Map()
let reconnectTimer = null
let destroyed = false

function resolveWebSocketUrl() {
  const explicit = String(import.meta.env.VITE_WS_URL ?? '').trim()
  const fromApiBase = String(import.meta.env.VITE_API_BASE_URL ?? '').trim()

  let url = explicit
  if (!url && fromApiBase) {
    url = `${fromApiBase.replace(/\/api\/?$/, '')}/ws`
  }
  if (!url) {
    url = 'http://localhost:8080/ws'
  }

  url = normalizeSockJsUrl(url)

  // Browsers block insecure SockJS from HTTPS pages.
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
    url = `https://${url.slice('http://'.length)}`
  }

  const token = normalizeJwtToken(useAuthStore.getState().token)
  if (token) {
    const joiner = url.includes('?') ? '&' : '?'
    url = `${url}${joiner}access_token=${encodeURIComponent(token)}`
  }
  return url
}

export function connectWebSocket(onNotification) {
  destroyed = false
  try {
    const socket = new SockJS(resolveWebSocketUrl())
    stompClient = Stomp.over(socket)

    // Silence STOMP debug logs in production
    stompClient.debug = import.meta.env.DEV ? console.log : () => {}

    const token = useAuthStore.getState().token
    const jwt = normalizeJwtToken(token)
    const connectHeaders = jwt ? { Authorization: `Bearer ${jwt}` } : {}

    stompClient.connect(
      connectHeaders,
      () => {
        reconnectAttempts = 0
        console.info('WebSocket connected')

        const sub1 = stompClient.subscribe('/user/queue/notifications', (msg) => {
          const notification = JSON.parse(msg.body)
          onNotification(notification)
        })

        const sub2 = stompClient.subscribe('/topic/notifications', (msg) => {
          const notification = JSON.parse(msg.body)
          onNotification(notification)
        })

        subscriptions.set('notifications', sub1)
        subscriptions.set('broadcast', sub2)
      },
      (error) => {
        console.error('WebSocket error:', error)
        if (!destroyed) {
          const delay = Math.min(30000, 5000 * (2 ** reconnectAttempts))
          reconnectAttempts = Math.min(reconnectAttempts + 1, 3)
          reconnectTimer = setTimeout(() => connectWebSocket(onNotification), delay)
        }
      }
    )
  } catch (err) {
    console.error('WebSocket connection failed:', err)
  }
}

export function disconnectWebSocket() {
  destroyed = true
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null }
  reconnectAttempts = 0
  subscriptions.forEach((sub) => sub.unsubscribe())
  subscriptions.clear()
  if (stompClient?.connected) {
    stompClient.disconnect(() => console.info('WebSocket disconnected'))
  }
  stompClient = null
}

export function sendMessage(destination, body) {
  if (stompClient?.connected) {
    stompClient.send(destination, {}, JSON.stringify(body))
  }
}
