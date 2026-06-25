import api from '@/utils/api'

/**
 * @typedef {Object} TransactionCategory
 * @property {number} transaction_category_id
 * @property {string} name
 * @property {string} created_at
 */

export const transactionCategoriesService = {
  /**
   * @returns {Promise<TransactionCategory[]>}
   */
  async list() {
    const { data } = await api.get('/transaction-categories')
    return data
  },
}

export default transactionCategoriesService
