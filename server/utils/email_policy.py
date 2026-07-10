"""Strict structural email validation layered on top of EmailStr.

EmailStr only checks RFC-level format, so garbage like ``dzelila@skj.skj``
passes. This module adds local-part rules, domain-label rules, and a
known-TLD check against a vendored IANA snapshot (``tlds.txt``, from
https://data.iana.org/TLD/tlds-alpha-by-domain.txt).

Use ``StrictEmailStr`` wherever a *new* email address is accepted
(register, profile email change, recovery email, admin create/update).
Do not use it for lookups of existing emails (login, forgot password) —
tightening those could lock out accounts created under looser rules.
"""

import re
from pathlib import Path
from typing import Annotated

from pydantic import AfterValidator, EmailStr
from pydantic_core import PydanticCustomError

EMAIL_INVALID_MESSAGE = "Enter a valid email address."
EMAIL_DOMAIN_UNSUPPORTED_MESSAGE = "This email domain is not supported."

LOCAL_PART_MAX_LENGTH = 64
DOMAIN_MAX_LENGTH = 253
DOMAIN_LABEL_MAX_LENGTH = 63

# RFC 5322 dot-atom characters; dot placement is checked separately.
_LOCAL_PART_CHARS = re.compile(r"^[A-Za-z0-9!#$%&'*+/=?^_`{|}~.\-]+$")
_DOMAIN_LABEL = re.compile(r"^[A-Za-z0-9]([A-Za-z0-9\-]*[A-Za-z0-9])?$")


def _load_known_tlds() -> frozenset[str]:
    tlds_file = Path(__file__).with_name("tlds.txt")
    return frozenset(
        line.strip().lower()
        for line in tlds_file.read_text(encoding="ascii").splitlines()
        if line.strip() and not line.startswith("#")
    )


KNOWN_TLDS = _load_known_tlds()


def _invalid() -> PydanticCustomError:
    return PydanticCustomError("email_invalid", EMAIL_INVALID_MESSAGE)


def _unsupported_domain() -> PydanticCustomError:
    return PydanticCustomError("email_domain_unsupported", EMAIL_DOMAIN_UNSUPPORTED_MESSAGE)


def _tld_to_ascii(tld: str) -> str:
    """Map an internationalized TLD to its punycode form for the IANA lookup."""
    if tld.isascii():
        return tld
    try:
        return tld.encode("idna").decode("ascii")
    except UnicodeError:
        return tld


def validate_email_structure(value: str) -> str:
    local_part, _, domain = value.rpartition("@")

    if not local_part or len(local_part) > LOCAL_PART_MAX_LENGTH:
        raise _invalid()
    if not _LOCAL_PART_CHARS.match(local_part):
        raise _invalid()
    if local_part.startswith(".") or local_part.endswith(".") or ".." in local_part:
        raise _invalid()

    if not domain or len(domain) > DOMAIN_MAX_LENGTH:
        raise _invalid()
    labels = domain.split(".")
    if len(labels) < 2:
        raise _invalid()
    for label in labels:
        if not label or len(label) > DOMAIN_LABEL_MAX_LENGTH:
            raise _invalid()
        if label.isascii() and not _DOMAIN_LABEL.match(label):
            raise _invalid()

    tld = _tld_to_ascii(labels[-1].lower())
    if tld.isdigit() or tld not in KNOWN_TLDS:
        raise _unsupported_domain()

    return value


StrictEmailStr = Annotated[EmailStr, AfterValidator(validate_email_structure)]
