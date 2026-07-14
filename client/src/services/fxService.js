import api, { getApiErrorMessage } from '@/utils/api'

function unwrap(response) {
  const body = response?.data
  return body?.data ?? body
}

/**
 * Indicative currency conversion (informational only — moves no money).
 * @param {{ amount: number|string, from: string, to: string }} params
 * @returns {Promise<{ amount: string, from_currency: string, to_currency: string, rate: string, converted: string, indicative: boolean, source: string, disclaimer: string }>}
 */
export async function convertCurrency({ amount, from, to }) {
  try {
    const { data } = await api.get('/fx/convert', {
      params: { amount, from_currency: from, to_currency: to },
    })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not convert the amount.'))
  }
}

/**
 * Live reference rates for popular currencies against the euro.
 * @returns {Promise<{ base: string, cards: Array<{ pair: string, code: string, rate: string, change: string, trend: string, note: string }> }>}
 */
export async function getRateOverview() {
  try {
    const { data } = await api.get('/fx/rates')
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load reference rates.'))
  }
}

/**
 * Recent real history for a pair — sparkline points, 24h move, and range.
 * @param {{ from: string, to: string }} params
 * @returns {Promise<{ from_currency: string, to_currency: string, available: boolean, points: Array<{ date: string, rate: string }>, latest: string|null, change_pct: string|null, range_pct: string|null, summary: string }>}
 */
export async function getPairInsight({ from, to }) {
  try {
    const { data } = await api.get('/fx/insight', {
      params: { from_currency: from, to_currency: to },
    })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load exchange insight.'))
  }
}
