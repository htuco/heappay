function base64UrlToArrayBuffer(value) {
	const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
	const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
	const binary = window.atob(padded)
	const bytes = new Uint8Array(binary.length)

	for (let i = 0; i < binary.length; i += 1) {
		bytes[i] = binary.charCodeAt(i)
	}

	return bytes.buffer
}

function arrayBufferToBase64Url(buffer) {
	const bytes = new Uint8Array(buffer)
	let binary = ''

	for (const byte of bytes) {
		binary += String.fromCharCode(byte)
	}

	return window
		.btoa(binary)
		.replace(/\+/g, '-')
		.replace(/\//g, '_')
		.replace(/=+$/g, '')
}

function prepareCreationOptions(publicKey) {
	return {
		...publicKey,
		challenge: base64UrlToArrayBuffer(publicKey.challenge),
		user: {
			...publicKey.user,
			id: base64UrlToArrayBuffer(publicKey.user.id),
		},
		excludeCredentials: publicKey.excludeCredentials?.map((credential) => ({
			...credential,
			id: base64UrlToArrayBuffer(credential.id),
		})),
	}
}

function prepareRequestOptions(publicKey) {
	return {
		...publicKey,
		challenge: base64UrlToArrayBuffer(publicKey.challenge),
		allowCredentials: publicKey.allowCredentials?.map((credential) => ({
			...credential,
			id: base64UrlToArrayBuffer(credential.id),
		})),
	}
}

function serializeCreationCredential(credential) {
	return {
		id: credential.id,
		rawId: arrayBufferToBase64Url(credential.rawId),
		type: credential.type,
		authenticatorAttachment: credential.authenticatorAttachment,
		response: {
			clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
			attestationObject: arrayBufferToBase64Url(credential.response.attestationObject),
			transports: credential.response.getTransports?.() ?? [],
		},
		clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
	}
}

function serializeAssertionCredential(credential) {
	return {
		id: credential.id,
		rawId: arrayBufferToBase64Url(credential.rawId),
		type: credential.type,
		authenticatorAttachment: credential.authenticatorAttachment,
		response: {
			clientDataJSON: arrayBufferToBase64Url(credential.response.clientDataJSON),
			authenticatorData: arrayBufferToBase64Url(credential.response.authenticatorData),
			signature: arrayBufferToBase64Url(credential.response.signature),
			userHandle: credential.response.userHandle
				? arrayBufferToBase64Url(credential.response.userHandle)
				: null,
		},
		clientExtensionResults: credential.getClientExtensionResults?.() ?? {},
	}
}

export function isWebAuthnEnrollmentAvailable() {
	return Boolean(
		typeof window !== 'undefined' &&
			window.PublicKeyCredential &&
			navigator.credentials?.create,
	)
}

export async function createBiometricCredential(publicKey) {
	if (window.HeapNativeBiometrics?.registerCredential) {
		return window.HeapNativeBiometrics.registerCredential(publicKey)
	}

	if (!isWebAuthnEnrollmentAvailable()) {
		throw new Error('Biometric authentication is not available on this device or browser.')
	}

	const credential = await navigator.credentials.create({
		publicKey: prepareCreationOptions(publicKey),
	})

	if (!credential) {
		throw new Error('Biometric enrollment was cancelled.')
	}

	return serializeCreationCredential(credential)
}

export function isWebAuthnAssertionAvailable() {
	return Boolean(
		typeof window !== 'undefined' &&
			window.PublicKeyCredential &&
			navigator.credentials?.get,
	)
}

export async function getBiometricAssertion(publicKey) {
	if (window.HeapNativeBiometrics?.getAssertion) {
		return window.HeapNativeBiometrics.getAssertion(publicKey)
	}

	if (!isWebAuthnAssertionAvailable()) {
		throw new Error('Biometric authentication is not available on this device or browser.')
	}

	const credential = await navigator.credentials.get({
		publicKey: prepareRequestOptions(publicKey),
	})

	if (!credential) {
		throw new Error('Biometric verification was cancelled.')
	}

	return serializeAssertionCredential(credential)
}
