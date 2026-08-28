import api, { getApiErrorMessage } from '@/utils/api'

/**
 * Triggers a browser download for a Blob.
 * @param {Blob} blob
 * @param {string} filename
 */
export function downloadBlob(blob, filename) {
	const url = URL.createObjectURL(blob)
	const link = document.createElement('a')
	link.href = url
	link.download = filename
	document.body.appendChild(link)
	link.click()
	link.remove()
	URL.revokeObjectURL(url)
}

/**
 * With `responseType: 'blob'`, axios also delivers error response bodies as a
 * Blob instead of parsed JSON — decode it back to JSON so error messages
 * (e.g. rate-limit text) surface correctly instead of `[object Blob]`.
 * @param {unknown} error
 */
async function normalizeBlobError(error) {
	const data = /** @type {{ response?: { data?: unknown } }} */ (error)?.response?.data
	if (data instanceof Blob && data.type?.includes('json')) {
		try {
			error.response.data = JSON.parse(await data.text())
		} catch {
			// leave as-is; getApiErrorMessage will fall back to a generic message
		}
	}
	return error
}

/**
 * @param {string} path
 * @param {Record<string, unknown>} [params]
 * @param {string} fallbackFilename
 */
async function downloadPdf(path, params, fallbackFilename) {
	try {
		const response = await api.get(path, { params, responseType: 'blob' })
		downloadBlob(response.data, fallbackFilename)
	} catch (error) {
		throw new Error(getApiErrorMessage(await normalizeBlobError(error), 'Could not generate the PDF. Please try again.'))
	}
}

export const exportService = {
	/** Wallet summary: total balance + per-card breakdown. */
	walletSummaryPdf: () => downloadPdf('/export/wallet-summary.pdf', undefined, 'wallet-summary.pdf'),

	/**
	 * Transaction list, honouring the same filters as the Transactions page.
	 * Every active filter is forwarded so the PDF matches the on-screen list --
	 * the server runs them through the same query the list endpoint uses.
	 * @param {{ statusId?: number, transactionTypeId?: number, categoryId?: number, cardId?: number, fromDate?: string, toDate?: string, search?: string, sort?: string }} [filters]
	 */
	transactionsPdf: (filters = {}) =>
		downloadPdf(
			'/export/transactions.pdf',
			{
				status_id: filters.statusId,
				transaction_type_id: filters.transactionTypeId,
				category_id: filters.categoryId,
				card_id: filters.cardId,
				from_date: filters.fromDate,
				to_date: filters.toDate,
				q: filters.search?.trim() || undefined,
				sort: filters.sort,
			},
			'transactions.pdf',
		),

	/**
	 * Monthly income/expense + category breakdown report.
	 * @param {{ months?: number }} [options]
	 */
	monthlyReportPdf: (options = {}) =>
		downloadPdf('/export/monthly-report.pdf', { months: options.months ?? 1 }, 'monthly-report.pdf'),
}

export default exportService
