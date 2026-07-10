import api, { getApiErrorMessage } from '@/utils/api'
import { downloadBlob } from '@/services/exportService'

function buildAuditLogParams(params = {}) {
	const query = {}
	if (typeof params.page === 'number') query.page = params.page
	if (typeof params.pageSize === 'number') query.page_size = params.pageSize
	if (typeof params.eventType === 'string' && params.eventType) query.event_type = params.eventType
	if (typeof params.actorUserId === 'number') query.actor_user_id = params.actorUserId
	if (typeof params.targetUserId === 'number') query.target_user_id = params.targetUserId
	if (typeof params.fromDate === 'string' && params.fromDate) query.from_date = params.fromDate
	if (typeof params.toDate === 'string' && params.toDate) query.to_date = params.toDate
	if (typeof params.q === 'string' && params.q.trim()) query.q = params.q.trim()
	return query
}

export const auditLogService = {
	async list(params = {}) {
		try {
			const { data } = await api.get('/admin/audit-log', { params: buildAuditLogParams(params) })
			return data.data
		} catch (error) {
			throw new Error(getApiErrorMessage(error, 'Failed to load audit log.'))
		}
	},

	async listEventTypes() {
		try {
			const { data } = await api.get('/admin/audit-log/event-types')
			return data.data ?? []
		} catch (error) {
			throw new Error(getApiErrorMessage(error, 'Failed to load event types.'))
		}
	},

	async exportCsv(params = {}) {
		try {
			const response = await api.get('/admin/audit-log/export.csv', {
				params: buildAuditLogParams(params),
				responseType: 'blob',
			})
			downloadBlob(response.data, 'audit-log.csv')
		} catch (error) {
			throw new Error(getApiErrorMessage(error, 'Failed to export audit log.'))
		}
	},
}

export default auditLogService
