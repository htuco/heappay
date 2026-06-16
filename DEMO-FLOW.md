# Heap — Demo Flow (Kratki Brief)

Prezentuje: **Izel**. Lozinka za sve naloge: `Demo1234!`

| Nalog | Uloga |
| --- | --- |
| `izel@heap.demo` | User (glavni demo nalog) |
| `support@heap.demo` | Support |
| `admin@heap.demo` | Admin |

---

## 1. Izel (user) — `izel@heap.demo`

1. **Dashboard + Wallet** — balans, kartice, recent activity.
2. **Make Transaction** (Wallet) — wizard, biraš karticu, pošalji novac drugom
   članu tima → success.
3. **Request freeze** — Manage Cards → kartica (⋮) → "Request freeze" + razlog
   → dugme postaje "Freeze requested".

## 2. Support — `support@heap.demo`

4. **Users** — profilne slike, freeze/unfreeze kartice korisnika.
5. **Tickets** — refund zahtjev → Approve / Decline.

## 3. Admin — `admin@heap.demo`

6. **Users** — role (user/admin/support), **Save Changes**, **soft delete**
   (korisnik s pending transakcijom se ne može obrisati).
7. **Transactions** — sve transakcije u sistemu.
8. **Requests (nova stranica)**:
   - Tab **Refund** → Approve.
   - Tab **Freeze / Unfreeze** → Approve freeze (kartica se zamrzne) /
     Approve unfreeze (kartica se vrati na active).

---

**Highlight:** zamrznuta kartica **ne može slati ni primati** novac (sigurnost).
Backend FastAPI, baza PostgreSQL na Supabase.
