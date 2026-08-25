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
 * Recent real history for a pair — line-chart points, movement, and range.
 * @param {{ from: string, to: string, range?: '7d'|'30d'|'90d'|'1y' }} params
 * @returns {Promise<{ from_currency: string, to_currency: string, available: boolean, points: Array<{ date: string, rate: string }>, latest: string|null, change_pct: string|null, range_pct: string|null, summary: string }>}
 */
export async function getPairInsight({ from, to, range = '7d' }) {
  try {
    const { data } = await api.get('/fx/insight', {
      params: { from_currency: from, to_currency: to, range },
    })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load exchange insight.'))
  }
}

/**
 * The rate for one pair, without an amount.
 *
 * The display-currency switcher fetches this once per (stored → displayed) pair
 * and formats locally; /fx/convert would be one request per rendered figure.
 * @param {{ from: string, to: string }} params
 * @returns {Promise<{ from_currency: string, to_currency: string, rate: string, indicative: boolean, source: string, disclaimer: string }>}
 */
export async function getPairRate({ from, to }) {
  try {
    const { data } = await api.get('/fx/rate', {
      params: { from_currency: from, to_currency: to },
    })
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load the exchange rate.'))
  }
}

/**
 * Currency codes conversion can actually price — drives the display-currency
 * picker so the options can't drift from what the server supports.
 * @returns {Promise<{ base: string, codes: string[] }>}
 */
export async function getSupportedCurrencies() {
  try {
    const { data } = await api.get('/fx/currencies')
    return unwrap({ data })
  } catch (error) {
    throw new Error(getApiErrorMessage(error, 'Could not load supported currencies.'))
  }
}
