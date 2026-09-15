-- ============================================================================
-- Satu Login Fase B — sinkronisasi data `customers` → `users` (sekali jalan)
-- ============================================================================
--
-- Kenapa ada: antara 5 Sep 2026 (Fase A) dan 15 Sep 2026 (Fase B), beberapa
-- jalur masih menulis HANYA ke `customers`, sementara login membaca `users`:
--   - reset password         → customers.password_hash, sessions_revoked_at
--   - klik link verifikasi   → customers.email_verified_at
--   - lengkapi profil Google → customers.username, phone_number
--   - daftar manual          → baris baru di customers saja (hanya kalau
--                              REGISTER_MANUAL_ENABLED=true saat itu)
-- Sejak Fase B kode membaca & menulis `users` saja, jadi perubahan di atas
-- perlu disalin sekali.
--
-- ATURAN MENJALANKAN (docs/10-deployment-procedure.md):
--   1. Jalankan BAGIAN A (read-only) dulu, simpan hasilnya.
--   2. Kalau Bagian A.3 (bentrok username/email) TIDAK kosong, BERHENTI —
--      selesaikan manual dulu; UPDATE di bawah akan gagal di unique index.
--   3. Backup tabel `users` sebelum Bagian B.
--   4. Bagian B dijalankan dalam satu transaksi; periksa jumlah baris yang
--      berubah sebelum COMMIT.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- BAGIAN A — READ-ONLY. Aman dijalankan kapan saja.
-- ---------------------------------------------------------------------------

-- A.1 Pelanggan yang HANYA ada di `customers` (tidak punya baris `users`).
SELECT c.id, c.email, c.username, c.email_verified_at, c.created_at
FROM customers c
LEFT JOIN users u ON u.id = c.id
WHERE u.id IS NULL;

-- A.2 Baris yang nilainya berbeda antara kedua tabel.
--     `<=>` = pembanding yang aman terhadap NULL.
SELECT
  c.id,
  c.email,
  u.role,
  NOT (c.username          <=> u.username)          AS beda_username,
  NOT (c.phone_number      <=> u.phone_number)      AS beda_hp,
  NOT (c.password_hash     <=> u.password_hash)     AS beda_password,
  NOT (c.email_verified_at <=> u.email_verified_at) AS beda_verifikasi,
  NOT (c.sessions_revoked_at <=> u.sessions_revoked_at) AS beda_pencabutan,
  c.updated_at AS customers_updated_at,
  u.updated_at AS users_updated_at
FROM customers c
JOIN users u ON u.id = c.id
WHERE NOT (c.username          <=> u.username)
   OR NOT (c.phone_number      <=> u.phone_number)
   OR NOT (c.password_hash     <=> u.password_hash)
   OR NOT (c.email_verified_at <=> u.email_verified_at)
   OR NOT (c.sessions_revoked_at <=> u.sessions_revoked_at);

-- A.3 BENTROK: username/email di `customers` yang sudah dipakai akun LAIN di
--     `users`. Harus kosong sebelum Bagian B.
SELECT 'username' AS kolom, c.id AS customer_id, c.username AS nilai, u2.id AS dipakai_oleh, u2.role
FROM customers c
JOIN users u2 ON u2.username = c.username AND u2.id <> c.id
WHERE c.username IS NOT NULL
UNION ALL
SELECT 'email', c.id, c.email, u2.id, u2.role
FROM customers c
JOIN users u2 ON u2.email = c.email AND u2.id <> c.id;


-- ---------------------------------------------------------------------------
-- BAGIAN B — MENULIS. Sengaja dikomentari. Buka komentarnya hanya setelah
-- Bagian A diperiksa dan backup `users` dibuat.
-- ---------------------------------------------------------------------------

-- START TRANSACTION;
--
-- -- B.1 Salin perubahan yang hanya sempat tertulis ke `customers`.
-- --     Hanya untuk baris ber-role pelanggan — akun admin tidak pernah
-- --     disentuh skrip ini.
-- --     - username/HP/verifikasi: nilai customers dipakai kalau terisi (jalur
-- --       tulisnya selama celah itu hanya customers).
-- --     - password: customers dipakai hanya kalau baris customers lebih baru
-- --       (reset password terjadi sesudah migrasi Fase A).
-- --     - pencabutan sesi: ambil yang paling akhir dari keduanya.
-- UPDATE users u
-- JOIN customers c ON c.id = u.id
-- SET
--   u.username          = COALESCE(c.username, u.username),
--   u.phone_number      = COALESCE(c.phone_number, u.phone_number),
--   u.email_verified_at = COALESCE(u.email_verified_at, c.email_verified_at),
--   u.password_hash     = IF(c.updated_at > u.updated_at AND c.password_hash IS NOT NULL,
--                            c.password_hash, u.password_hash),
--   u.sessions_revoked_at = CASE
--     WHEN c.sessions_revoked_at IS NULL THEN u.sessions_revoked_at
--     WHEN u.sessions_revoked_at IS NULL THEN c.sessions_revoked_at
--     ELSE GREATEST(c.sessions_revoked_at, u.sessions_revoked_at)
--   END
-- WHERE u.role = 'pelanggan';
--
-- -- B.2 Pindahkan pelanggan yang hanya ada di `customers`.
-- --     role WAJIB 'pelanggan' — default kolomnya 'owner'.
-- INSERT INTO users
--   (id, email, name, username, password_hash, google_sub, phone_number,
--    email_verified_at, sessions_revoked_at, role, created_at, updated_at)
-- SELECT
--   c.id, c.email, c.name, c.username, c.password_hash, c.google_sub, c.phone_number,
--   c.email_verified_at, c.sessions_revoked_at, 'pelanggan', c.created_at, c.updated_at
-- FROM customers c
-- LEFT JOIN users u ON u.id = c.id
-- WHERE u.id IS NULL;
--
-- -- Periksa jumlah baris dari dua perintah di atas, lalu:
-- COMMIT;
-- -- atau ROLLBACK; kalau angkanya tidak sesuai hasil Bagian A.
