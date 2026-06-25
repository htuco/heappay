import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { chatService } from '@/services/chatService'
import { getApiErrorMessage } from '@/utils/api'

export function useChat(agentMode = false) {
  const { user, isLoading: authLoading } = useAuth()
  const [messages, setMessages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setMessages([])
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    chatService
      .getHistory(agentMode)
      .then((history) => {
        if (!cancelled) setMessages(history)
      })
      .catch(() => {
        if (!cancelled) setMessages([])
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [authLoading, user, agentMode])

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim()
    if (!trimmed) return

    setMessages((prev) => [...prev, { role: 'user', content: trimmed, created_at: new Date().toISOString() }])
    setIsSending(true)

    try {
      const { history } = await chatService.sendMessage(trimmed, agentMode)
      setMessages(history)
    } catch (err) {
      console.error('Chat error:', err)
      // Surface the server's specific reason when it has one (e.g. the assistant
      // isn't configured, or the AI quota is exhausted) so the chat degrades
      // visibly instead of always showing a generic failure.
      const content = getApiErrorMessage(err, 'Sorry, something went wrong. Please try again.')
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content, created_at: new Date().toISOString() },
      ])
    } finally {
      setIsSending(false)
    }
  }, [agentMode])

  const clearHistory = useCallback(async () => {
    await chatService.clearHistory(agentMode)
    setMessages([])
  }, [agentMode])

  return { messages, isLoading, isSending, sendMessage, clearHistory }
}
