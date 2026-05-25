import api from '@/utils/api'

/**
 * Generic authenticated image upload — returns public object URL from Supabase Storage.
 * @param {File} file
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadImage(file) {
	const formData = new FormData()
	formData.append('file', file)
	const { data } = await api.post('/storage/images', formData)
	return data.data
}
