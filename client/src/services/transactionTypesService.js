import api from '@/utils/api'

/**
 * @typedef {Object} TransactionType
 * @property {number} transaction_type_id
 * @property {string} name
 * @property {string} created_at
 */

export const transactionTypesService = {
  /**
   * @returns {Promise<TransactionType[]>}
   */
  async list() {
    const { data } = await api.get('/transaction-types')
    return data
  },
}

export default transactionTypesService
