import { useEffect, useRef, useState } from 'react'
import { MessageCircle, Send, Trash2, X, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useChat } from '@/hooks/useChat'

const SUGGESTIONS = {
  chat: [
    { label: "What's my balance?", prompt: "What's my balance?" },
    { label: 'Recent transactions', prompt: 'Show my recent transactions' },
    { label: 'Spending this month', prompt: 'How much did I spend this month?' },
  ],
  actions: [
    { label: 'Send money', prompt: 'I want to send money' },
    { label: 'Top up a card', prompt: 'I want to top up one of my cards' },
    { label: 'Freeze a card', prompt: 'I want to freeze one of my cards' },
    { label: 'Request a refund', prompt: 'I want to request a refund for a transaction' },
  ],
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [agentMode, setAgentMode] = useState(false)
  const [confirmClear, setConfirmClear] = useState(false)
  const { messages, isLoading, isSending, sendMessage, clearHistory } = useChat(agentMode, open)
  const bottomRef = useRef(null)
  const modeLabel = agentMode ? 'Actions' : 'Chat'

  // Switching mode or closing disarms the delete prompt: it belongs to one
  // conversation, and leaving it armed would put the next visit one stray click
  // away from deleting the wrong one.
  const selectMode = (next) => {
    setAgentMode(next)
    setConfirmClear(false)
  }

  const toggleOpen = () => {
    setOpen((v) => !v)
    setConfirmClear(false)
  }

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  const handleSend = async () => {
    if (!input.trim() || isSending) return
    const text = input
    setInput('')
    await sendMessage(text)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSuggestion = (prompt) => {
    if (isSending) return
    sendMessage(prompt)
  }

  const suggestions = agentMode ? SUGGESTIONS.actions : SUGGESTIONS.chat
  const showSuggestions = !isLoading && !isSending && messages.length === 0

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {open && (
        <div className="flex flex-col w-80 h-[480px] rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex flex-col border-b border-border/60 bg-card">
            <div className="flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">heap Assistant</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setConfirmClear(true)}
                  disabled={messages.length === 0}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  title={`Delete this ${modeLabel} conversation`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  New chat
                </button>
                <button
                  onClick={toggleOpen}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-1 px-4 pb-3">
              <div className="flex rounded-lg bg-muted/60 p-0.5 gap-0.5 w-full">
                <button
                  onClick={() => selectMode(false)}
                  className={`flex-1 text-xs font-medium py-1 px-2 rounded-md transition-colors ${
                    !agentMode
                      ? 'bg-card text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Chat
                </button>
                <button
                  onClick={() => selectMode(true)}
                  className={`flex-1 flex items-center justify-center gap-1 text-xs font-medium py-1 px-2 rounded-md transition-colors ${
                    agentMode
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Zap className="h-3 w-3" />
                  Actions
                </button>
              </div>
            </div>

            {confirmClear && (
              <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/40 px-4 py-2">
                <span className="text-xs text-muted-foreground">
                  Delete this {modeLabel} conversation?
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setConfirmClear(false)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      setConfirmClear(false)
                      await clearHistory()
                    }}
                    className="rounded-md bg-destructive px-2 py-1 text-xs font-semibold text-destructive-foreground transition-opacity hover:opacity-90"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="flex gap-1">
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                </div>
              </div>
            ) : messages.length === 0 ? (
              /* Naming the mode matters: Chat and Actions keep separate
                 conversations, so an empty pane here is a different conversation,
                 not a lost one. */
              <div className="py-8 text-center">
                <p className="text-xs font-semibold text-foreground">{modeLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {agentMode
                    ? 'Send money, freeze a card, or request a refund — just ask.'
                    : 'Ask me anything about your account, cards, or transactions.'}
                </p>
                <p className="mt-2 text-[11px] text-muted-foreground/70">
                  {agentMode ? 'Chat' : 'Actions'} keeps its own separate conversation.
                </p>
              </div>
            ) : (
              messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap ${
                      msg.role === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            {isSending && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {showSuggestions && (
            <div className="flex flex-wrap gap-1.5 px-4 pb-1 pt-2">
              {suggestions.map((s) => (
                <button
                  key={s.label}
                  onClick={() => handleSuggestion(s.prompt)}
                  className="text-xs rounded-full border border-border/60 bg-muted/40 px-2.5 py-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="flex gap-2 px-4 py-3 border-t border-border/60">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={agentMode ? 'What do you want to do?' : 'Ask me anything...'}
              disabled={isSending}
              className="text-sm"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={isSending || !input.trim()}
              className="shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={toggleOpen}
        className="h-12 w-12 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-colors"
      >
        {open ? <X className="h-5 w-5" /> : <MessageCircle className="h-5 w-5" />}
      </button>
    </div>
  )
}
