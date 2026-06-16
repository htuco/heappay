# Sažetak Izmjena — Sesija (Admin, Zahtjevi I Zamrzavanje Kartica)

Ovaj dokument opisuje sve što je urađeno u ovoj radnoj sesiji na Heap projektu.
Pisano na bosanskom jeziku radi internog pregleda.

Grana: `feature/admin-and-requests-overhaul` (odvojena sa svježeg `main`).
Baza: Supabase PostgreSQL (sve migracije primijenjene).
Testovi: `117 prošlo` (114 postojećih + 3 nova). Build klijenta: prolazi. Lint: čisto.

---

## 1. Originalne Funkcionalnosti (Iz Specifikacije)

### #1 — "Napravi Transakciju" Na Wallet Stranici
- Na Wallet stranici dugme/pločica **"Make Transaction"** sada otvara **Payment Wizard**
  direktno na toj stranici (ne navigira na `/payments`).
- Kartica **nije unaprijed odabrana** — korisnik je bira u prvom koraku ("Choose a card").
- Logika: `PaymentWizard` već podržava ovo (kad se ne proslijedi `initialCardId`,
  otvara se na koraku 0).
- Fajl: `client/src/components/wallet/WalletQuickActions.jsx`.

### #2 — Dugme "Send" Na Stranici Transakcija
- Na `/payments` (stranica historije transakcija) dodano je primarno dugme **"Send"**
  u zaglavlju koje otvara Payment Wizard (bez unaprijed odabrane kartice).
- Lista transakcija se osvježi nakon uspješnog slanja.
- Fajl: `client/src/pages/PaymentPage.jsx`.

### #2 (Admin) — Profilne Slike Na admin/users
- `AdminUsersPanel` sada koristi zajedničku `UserAvatar` komponentu koja prikazuje
  stvarni `avatar_url` (umjesto samo inicijala).
- `useAdminData` sada prenosi `avatarUrl`, `firstName`, `lastName` kroz model.
- Fajlovi: `client/src/components/admin/AdminUsersPanel.jsx`,
  `client/src/hooks/useAdminData.js`.

### #3 — Soft Delete Korisnika + Zaštita
- Brisanje korisnika je već bilo **soft delete** na backendu.
- Dodana **zaštita**: korisnik se ne može obrisati ako ima transakciju u statusu
  `pending` (vraća `409`).
- Tekst potvrde u modalu ispravljen sa "Permanently delete… cannot be undone" na
  jasnu poruku da je riječ o soft deleteu koji se može vratiti.
- Fajlovi: `server/services/user/user.py`, `server/repositories/user/user.py`,
  `server/routes/user/user.py`, `client/src/components/admin/UserDetailsDialog.jsx`.

### #4 — Uklanjanje "Manager" Role
- Uloga `manager` uklonjena sa cijelog sistema (uloge su sada **user / admin / support**).
- Migracija: korisnici sa `manager` rolom prebačeni na `support`, zatim red obrisan.
- Očišćeno na backendu (`dependencies.py`) i frontendu (8 fajlova: `useAuth.js`,
  `navLinks.js`, `navbar.jsx`, `admin.constants.js`, `admin.utils.js`,
  `usePendingRefundWatcher.js`, `UserDetailsDialog.jsx`, `AdminUsersPanel.jsx`).

### #5 — Zahtjev Za Zamrzavanje Kartice
- Korisnik može zatražiti zamrzavanje svoje kartice (npr. izgubljena/ukradena).
- Novi tip zahtjeva `card_freeze` + tabela `card_freeze_request_details`.
- Cijeli životni ciklus (po uzoru na refund): kreiranje → odobravanje (zamrzava karticu)
  → odbijanje. Isti "pending lock" mehanizam protiv dvostrukog odobravanja.
- Korisnik pokreće iz **Manage Cards modala** (Wallet) i iz **Settings** kartica sekcije.
- Kad postoji aktivan zahtjev, dugme prikazuje **"Freeze requested"** (onemogućeno).
- Kasnije dodano i **polje za razlog** zamrzavanja (vidi sekciju 3).

### #6 — Dugme "Save Changes" Na admin/users Modalu
- Provjereno: dugme **ima svrhu** — čuva promjenu role korisnika
  (`usersService.update`), osvježava listu, šalje notifikaciju.
- Poboljšanje: dugme je sada onemogućeno dok se rola stvarno ne promijeni (dirty check).

### #7 — Admin I Support Mogu Odmrznuti Karticu
- Provjereno: backend rute `/cards/{id}/block` i `/unblock` koriste `require_staff`
  (admin + support). `SupportUsersPage` već prosljeđuje `canManageCards`.
- Radilo je već — bez izmjene koda, samo verifikacija.

### #8 — Uklanjanje "Spend MTD" I "Last Active"
- Kolone "Spend (MTD)" i "Last Active" (placeholderi sa `—`) uklonjene iz
  `AdminUsersPanel` tabele. Širine kolona prilagođene.

### #9 / #10 — Admin Transakcije I Zahtjevi U Zasebnim Stranicama
- `/admin/transactions` već prikazuje **sve transakcije** (nije bilo potrebe za izmjenom).
- Nova stranica **`/admin/requests`** sa tabovima:
  - **Refund Requests** (refund zahtjevi)
  - **Freeze / Unfreeze** (zahtjevi za zamrzavanje i odmrzavanje)
- Dodana ruta u `App.jsx` i nav link ("Requests") u admin navigaciji.
- Fajlovi: `client/src/pages/AdminRequestsPage.jsx`,
  `client/src/components/admin/FreezeRequestDialog.jsx`.

---

## 2. Popravke Grešaka (Tokom Sesije)

### Login Nije Radio
- Uzrok: knowledge sync se izvršavao **sinhrono na startu** i blokirao uvicorn da se
  pokrene (a pod `--reload` se ponavljao na svaku izmjenu fajla).
- Popravka: sync se sada pokreće na scheduler niti ~5s nakon starta (ne blokira),
  uz `coalesce` + `max_instances=1` da se ne gomila.
- Fajl: `server/main.py`.

### "The Frozen Card Status Is Not Configured"
- Uzrok: ova baza je imala statuse kartica `active/blocked/inactive`, a kod očekuje
  `active/frozen/expired/cancelled` (i postojeće Freeze dugme je bilo pokvareno).
- Popravka: data migracija preimenuje `blocked` → `frozen` i dodaje `expired`/`cancelled`.
- Migracija: `d9b2f4e10c83_reconcile_card_statuses.py`.

### `list_users() Missing Argument 'q'`
- Uzrok: pozivaoci u `knowledge_sync.py` i `chat.py` su zvali `list_users` bez `q`,
  ali je `q` bio obavezan.
- Popravka: `q` (i ostali filteri) sada imaju default vrijednosti.
- Fajl: `server/repositories/user/user.py`.

---

## 3. Dodatni Zahtjevi (Kraj Sesije)

### Razlog Za Zamrzavanje Kartice
- Dodano opcionalno **polje "Reason"** (textarea, max 255 znakova) u dijalog za
  potvrdu zamrzavanja. Prosljeđuje se kao `note` na API (admin ga vidi kao "Reason").

### Zamrznuta Kartica Ne Smije Slati/Primati Novac (Sigurnosna Greška)
- `TransactionService.create()` sada odbija transakciju ako je **pošiljaočeva** ili
  **primaočeva** kartica zamrznuta → `400` sa jasnom porukom.
- Dodana 3 testa (zamrznut pošiljalac, zamrznut primalac, aktivne kartice prolaze).

### Zahtjev Za Odmrzavanje Kartice
- Novi tip zahtjeva `card_unfreeze` (koristi istu detail tabelu kao freeze).
- Životni ciklus: korisnik traži → staff **odobri (vraća karticu na `active`)** / odbije.
- Korisnik: u Manage Cards, zamrznuta kartica nudi **"Request unfreeze"**
  (postaje "Unfreeze requested" dok je na čekanju).
- Admin: tab **"Freeze / Unfreeze"** lista oba tipa, sa **Type** kolonom; dijalog
  odobrava/odbija ispravan tip.

### Oznaka Kad Je Glavna Kartica Zamrznuta
- Na Wallet stranici se prikazuje **baner** kad je glavna kartica zamrznuta —
  poziva korisnika da zatraži aktivaciju ili da postavi drugu karticu kao glavnu
  (preko Manage Cards). Prikazuje "under review" ako zahtjev za odmrzavanje već postoji.

---

## 4. Migracije (Redoslijed)

1. `a5fd998c612e` — merge dva otvorena heada (postojeća divergencija na `main`)
2. `b1f7a3d92c40` — uklanjanje `manager` role (manageri → support)
3. `c4e8a1b6f730` — `card_freeze` tip + tabela `card_freeze_request_details`
4. `d9b2f4e10c83` — usklađivanje statusa kartica (`blocked` → `frozen`, + `expired`/`cancelled`)
5. `e1c7a9d34f02` — `card_unfreeze` tip zahtjeva

Trenutni head baze: `e1c7a9d34f02`. Sve primijenjeno na Supabase.

---

## 5. Status

- **Testovi:** 117 prošlo.
- **Build klijenta:** prolazi (samo postojeće upozorenje o veličini chunka).
- **Lint:** svi izmijenjeni fajlovi čisti.
- **Server:** ponovo pokrenut, zdrav na `:8000`.
- **Grana:** `feature/admin-and-requests-overhaul`. `main` netaknut.

> Napomena: rad još nije commitan/pushan — čeka se potvrda prije commita po
> gitflow konvenciji projekta (mali logički commitovi, Title Case, bez
> `Co-Authored-By`).
