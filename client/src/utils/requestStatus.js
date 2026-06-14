// Seeded request_statuses ids (see server alembic a1b2c3d4e5f6): the lookup
// table is append-only, so these ids are stable.
export const REQUEST_STATUS_IDS = {
  pending: 1,
  approved: 2,
  declined: 3,
  cancelled: 4,
}

export const REQUEST_STATUS_META = {
  [REQUEST_STATUS_IDS.pending]: { label: 'Pending', variant: 'warning' },
  [REQUEST_STATUS_IDS.approved]: { label: 'Approved', variant: 'success' },
  [REQUEST_STATUS_IDS.declined]: { label: 'Declined', variant: 'error' },
  [REQUEST_STATUS_IDS.cancelled]: { label: 'Cancelled', variant: 'secondary' },
}
