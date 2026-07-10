"""Append-only audit log helpers and event type constants."""

from sqlalchemy.orm import Session

from models.audit_log_event import AuditLogEvent

# Auth
EVENT_LOGIN_SUCCESS = "login_success"
EVENT_LOGIN_FAILED = "login_failed"

# Admin user management
EVENT_USER_CREATED = "user_created"
EVENT_USER_UPDATED = "user_updated"
EVENT_USER_DELETED = "user_deleted"
EVENT_USER_SUSPENDED = "user_suspended"
EVENT_USER_ACTIVATED = "user_activated"

# Refund / request decisions
EVENT_REFUND_APPROVED = "refund_approved"
EVENT_REFUND_DECLINED = "refund_declined"
EVENT_FREEZE_APPROVED = "freeze_approved"
EVENT_FREEZE_DECLINED = "freeze_declined"
EVENT_UNFREEZE_APPROVED = "unfreeze_approved"
EVENT_UNFREEZE_DECLINED = "unfreeze_declined"

# Recovery email (mirrored from user_security_audit_events)
EVENT_RECOVERY_EMAIL_ADDED = "recovery_email_added"
EVENT_RECOVERY_EMAIL_CHANGED = "recovery_email_changed"
EVENT_RECOVERY_EMAIL_VERIFIED = "recovery_email_verified"
EVENT_RECOVERY_EMAIL_REMOVED = "recovery_email_removed"

# Future: category / rule changes when CRUD exists
EVENT_CATEGORY_RULE_CHANGED = "category_rule_changed"

AUDIT_EVENT_LABELS: dict[str, str] = {
    EVENT_LOGIN_SUCCESS: "Login success",
    EVENT_LOGIN_FAILED: "Login failed",
    EVENT_USER_CREATED: "User created",
    EVENT_USER_UPDATED: "User updated",
    EVENT_USER_DELETED: "User deleted",
    EVENT_USER_SUSPENDED: "User suspended",
    EVENT_USER_ACTIVATED: "User activated",
    EVENT_REFUND_APPROVED: "Refund approved",
    EVENT_REFUND_DECLINED: "Refund declined",
    EVENT_FREEZE_APPROVED: "Freeze approved",
    EVENT_FREEZE_DECLINED: "Freeze declined",
    EVENT_UNFREEZE_APPROVED: "Unfreeze approved",
    EVENT_UNFREEZE_DECLINED: "Unfreeze declined",
    EVENT_RECOVERY_EMAIL_ADDED: "Recovery email added",
    EVENT_RECOVERY_EMAIL_CHANGED: "Recovery email changed",
    EVENT_RECOVERY_EMAIL_VERIFIED: "Recovery email verified",
    EVENT_RECOVERY_EMAIL_REMOVED: "Recovery email removed",
    EVENT_CATEGORY_RULE_CHANGED: "Category rule changed",
}


def record_audit_log(
    db: Session,
    *,
    event_type: str,
    actor_user_id: int | None = None,
    target_user_id: int | None = None,
    resource_type: str | None = None,
    resource_id: str | int | None = None,
    detail: str | None = None,
    ip_address: str | None = None,
) -> None:
    resource_id_str = str(resource_id) if resource_id is not None else None
    if detail and len(detail) > 500:
        detail = detail[:497] + "..."
    row = AuditLogEvent(
        event_type=event_type,
        actor_user_id=actor_user_id,
        target_user_id=target_user_id,
        resource_type=resource_type,
        resource_id=resource_id_str,
        detail=detail,
        ip_address=ip_address,
    )
    db.add(row)
    db.commit()
