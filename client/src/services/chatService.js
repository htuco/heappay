import api from '@/utils/api'

export const chatService = {
  async sendMessage(message, agentMode = false) {
    const { data } = await api.post('/chat/message', { message, agent_mode: agentMode })
    return data
  },

  async getHistory() {
    const { data } = await api.get('/chat/history')
    return data
  },

  async clearHistory() {
    await api.delete('/chat/history')
  },
}
