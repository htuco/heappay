import pyotp
from cryptography.fernet import Fernet, InvalidToken


def generate_totp_secret() -> str:
    """Generate a new random base32 TOTP secret (160-bit, RFC 6238 compliant)."""
    return pyotp.random_base32()


def encrypt_secret(plain_secret: str, encryption_key: str) -> str:
    """Encrypt a TOTP secret before storing it in the database."""
    fernet = Fernet(encryption_key.encode())
    return fernet.encrypt(plain_secret.encode()).decode()


def decrypt_secret(encrypted_secret: str, encryption_key: str) -> str:
    """Decrypt a TOTP secret retrieved from the database."""
    fernet = Fernet(encryption_key.encode())
    try:
        return fernet.decrypt(encrypted_secret.encode()).decode()
    except InvalidToken as e:
        raise ValueError("Failed to decrypt TOTP secret — wrong key or corrupted data") from e


def build_totp_uri(plain_secret: str, email: str, issuer: str = "Heap") -> str:
    """Build the otpauth:// URI used to generate a QR code for authenticator apps."""
    totp = pyotp.TOTP(plain_secret)
    return totp.provisioning_uri(name=email, issuer_name=issuer)


def verify_totp_code(plain_secret: str, code: str) -> bool:
    """
    Verify a 6-digit TOTP code against the secret.
    valid_window=1 accepts one period before/after to tolerate clock drift.
    """
    totp = pyotp.TOTP(plain_secret)
    return totp.verify(code, valid_window=1)
