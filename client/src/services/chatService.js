import api from '@/utils/api'

export const chatService = {
  async sendMessage(message) {
    const { data } = await api.post('/chat/message', { message })
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
