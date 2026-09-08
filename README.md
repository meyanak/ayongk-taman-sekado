# Meyanak Social Network

Versi ini mengubah prototype frontend menjadi starter jejaring sosial multi-pengguna berbasis **Supabase Auth + PostgreSQL + Storage + Row Level Security (RLS)**.

## Fitur yang sudah terhubung

- Register & Login
- Session pengguna
- Profil pengguna otomatis setelah register
- Upload tulisan
- Upload gambar
- Upload video
- Posting publik
- Posting privat / hanya saya
- Like / unlike
- Komentar
- Simpan postingan
- Bagikan tautan postingan
- Hapus postingan milik sendiri
- Pencarian pengguna/postingan
- Daftar pengguna lain
- Pesan privat antar pengguna
- Penyimpanan media di Storage
- Database terpusat
- Row Level Security
- Responsive desktop/tablet/mobile

## Setup agar dapat diakses banyak orang

1. Buat project di Supabase.
2. Buka **SQL Editor**.
3. Jalankan seluruh isi `schema.sql`.
4. Salin `config.example.js` menjadi `config.js`.
5. Isi URL project dan **anon/public key** Supabase.
6. Tambahkan `<script src="config.js"></script>` sebelum `app.js` di `index.html`.
7. Untuk email confirmation, atur Authentication > URL Configuration sesuai domain deployment Anda.
8. Deploy folder ini ke hosting static seperti Netlify, Vercel, Cloudflare Pages, GitHub Pages, atau server web biasa.
9. Jangan pernah menaruh `service_role` key di frontend.

## Cara kerja algoritma utama

Register:
Auth -> trigger `handle_new_user()` -> `profiles`.

Posting:
login -> pilih tulisan/media -> upload ke Storage -> simpan metadata URL/path ke `posts` -> feed hanya menampilkan row yang lolos RLS.

Privasi:
`posts.visibility = public` dapat dibaca user login; `private` hanya dapat dibaca pemilik.

Like:
satu pasangan `(post_id,user_id)` hanya boleh sekali karena primary key.

Komentar:
user login dapat membuat komentar pada posting publik; RLS membatasi pembacaan sesuai visibilitas.

Simpan:
satu user hanya punya satu save per postingan.

Pesan:
RLS hanya mengizinkan pengirim/penerima membaca percakapan.

## Catatan produksi

Untuk skala besar, tambahkan pagination/infinite scroll, image/video processing, rate limiting, moderation, abuse reporting, antivirus/media validation, signed URLs untuk media privat, notification tables, dan realtime subscriptions.

Prototype awal sebelumnya memang berjalan hanya dengan array JavaScript lokal dan belum mempunyai backend/database; versi ini mengganti alur tersebut dengan data persisten.