import api from '@/utils/api'

export const chatService = {
  async sendMessage(message, agentMode = false) {
    const { data } = await api.post('/chat/message', { message, agent_mode: agentMode })
    return data
  },

  async getHistory(agentMode = false) {
    const { data } = await api.get('/chat/history', { params: { agent_mode: agentMode } })
    return data
  },

  async clearHistory(agentMode = false) {
    await api.delete('/chat/history', { params: { agent_mode: agentMode } })
  },
}
