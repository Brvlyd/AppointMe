# answers.md

## 1. Konflik Zona Waktu

Seluruh logika zona waktu ada di satu file, `lib/time.ts`, dan dipakai persis sama di server
(validasi API) maupun di client (preview langsung di form pembuatan janji temu) — jadi hanya
ada satu implementasi, bukan dua yang bisa berbeda seiring waktu.

**Penyimpanan dan konversi.** Setiap `Appointment.start`/`end` disimpan sebagai `timestamptz`
di Postgres (instan UTC absolut, bukan timestamp naif). `preferredTimezone` milik user adalah
nama zona IANA (mis. `Asia/Jakarta`), bukan offset mentah — offset akan rusak begitu terjadi
pergeseran DST, sedangkan nama IANA tidak. `localWallTimeToUtc(localIso, zone)` membaca string
naif "YYYY-MM-DDTHH:mm" (yang dihasilkan `<input type="datetime-local">`) sebagai waktu
wall-clock *di zona milik pembuat janji temu*, lalu mengonversinya ke UTC untuk disimpan. Saat
ditampilkan, `formatTimeParts`/`formatInZone` melakukan kebalikannya: mengonversi instan UTC
yang tersimpan ke zona *milik viewer yang sedang login*, bukan zona pembuatnya — sudah
diverifikasi langsung: janji temu yang sama tampil `16:00 (Asia/Jakarta)` untuk satu user yang
login, dan `10:00 (Europe/London)` untuk user lain, padahal instan waktunya sama persis.

**Konflik jam kerja.** `validateAppointmentWindow(utcStart, utcEnd, zones)` mengecek satu slot
yang diajukan terhadap zona *semua* partisipan sekaligus — termasuk pembuatnya, karena pembuat
janji temu secara fungsional juga partisipan di rapatnya sendiri, meskipun ia tidak mendapat
baris di `AppointmentParticipant` (tabel itu memodelkan *undangan*; relasi pembuat ada langsung
di `Appointment.creatorId`). Dua hal yang tidak bergantung zona dicek sekali di awal: waktu
selesai harus setelah waktu mulai, dan (lihat "keputusan tambahan" di bawah) slotnya tidak
boleh di masa lalu atau terlalu jauh di masa depan. Per zona, dua hal dicek: slot harus
seluruhnya berada dalam jam kerja 08:00–17:00 waktu lokal, dan waktu mulai/selesai harus jatuh
pada *hari kalender yang sama* secara lokal — sebuah janji temu tidak boleh melewati batas hari.
Zona-zona di-dedup sebelum loop per-zona; tanpa ini, pembuat dan seorang undangan yang berada
di zona yang sama (misal sama-sama `Asia/Jakarta`) akan memicu pelanggaran yang identik dua kali.

**Koreksi terhadap brief itu sendiri.** Bagian 5 dari brief klien menyebut Asia/Jakarta ↔
Pacific/Auckland sebagai contoh pasangan zona yang "tidak punya slot jam kerja yang sama-sama
cocok". Itu sebenarnya tidak benar: Jakarta UTC+7 dan Auckland UTC+13 di bulan Oktober (NZDT),
selisihnya cuma 6 jam — lebih sempit dari jendela 9 jam (08:00–17:00), jadi secara matematis
pasti ada slot yang cocok untuk keduanya. Unit test (`lib/time.test.ts`) membuktikannya: pukul
08:00–11:00 di Jakarta persis sama dengan 14:00–17:00 di Auckland, valid untuk keduanya.
Pasangan zona yang benar-benar tidak punya overlap di antara user seed aplikasi ini adalah
Asia/Jakarta ↔ America/New_York (selisih 11 jam, lebih lebar dari jendela 9 jam manapun) —
pasangan inilah yang dipakai test untuk menutupi kasus "benar-benar tidak ada slot yang cocok",
dan kedua temuan ini didokumentasikan di `docs/ASSIGNMENT.md` dan `docs/PROGRESS.md`, bukan
diam-diam memperbaiki contoh di brief.

**DST (perubahan jam musiman).** Luxon + data zona IANA menangani perhitungan tanggalnya dengan
benar saat melewati batas DST, tapi ada dua kasus tepi yang butuh keputusan eksplisit dan
teruji, bukan sekadar diasumsikan "harusnya sih aman":
- **Celah maju (spring-forward)** — waktu wall-clock yang sebenarnya tidak pernah terjadi
  (mis. `02:30` pada hari jam AS melompat dari 02:00 ke 03:00). Luxon tidak menolak input ini;
  ia diam-diam menyelesaikannya memakai offset yang berlaku *tepat sebelum* lompatan tersebut.
  `lib/time.test.ts` memverifikasi perilaku ini secara eksplisit lengkap dengan komentar
  penjelasannya, alih-alih dibiarkan "kebetulan jalan" tanpa test.
- **Ambiguitas mundur (fall-back)** — waktu wall-clock yang terjadi *dua kali* (mis. `01:30`
  saat jam AS mundur). Luxon memilih kemunculan pertama. Ini juga diverifikasi secara eksplisit.

**Kenapa janji temu lintas tengah malam ditolak, bukan diizinkan:** brief tidak mensyaratkan
janji temu multi-hari, dan mengizinkannya justru membuka ambiguitas yang sebenarnya ingin
dihindari proyek ini — misalnya "23:00 sampai 01:00" melewati batas tanggal, dan bisa dibaca
berbeda tergantung jendela jam kerja hari yang mana yang dipakai untuk mengeceknya. Menolaknya
(dengan pesan yang menyebut tanggal aslinya di kedua sisi, mis. "waktu mulai (22 Okt) dan
selesai (31 Okt) jatuh di hari yang berbeda") membuat aturan jam kerja tetap tidak ambigu: satu
hari kalender, di zona masing-masing partisipan, atau dianggap tidak valid. Jika produk nyata
butuh event multi-hari, itu akan jadi fitur terpisah dengan aturannya sendiri, bukan efek
samping tak sengaja dari validasi yang longgar.

**Keputusan tambahan yang ditemukan saat pengujian manual, bukan bagian dari desain awal:**
kesalahan ketik pada field tanggal (user mengetik tahun `0111` alih-alih `2026`) menghasilkan
tanggal ISO yang secara teknis valid tapi sebenarnya *salah*, dan karena tidak ada pengecekan
"apakah janji temu ini benar-benar di masa depan", data ini tersimpan begitu saja lalu terlihat
seperti bug "janji temu menghilang" (janji temu itu memang benar dikecualikan dari daftar
"mendatang", hanya saja tidak dicegah saat pembuatan). Diperbaiki dengan menambahkan pengecekan
`start-in-the-past` dan `too-far-in-future` (dibatasi sekitar 2 tahun) langsung di
`validateAppointmentWindow` — fungsi yang sama yang dipanggil baik oleh server maupun preview
langsung di client — ditambah batas `min`/`max` native pada date picker sebagai lapis pertahanan
pertama, bukan yang utama.

## 2. Optimasi Database

Index dibuat pada setiap kolom yang benar-benar dipakai untuk filter atau join oleh pola query
yang ada: `User.username` (unique, dipakai di setiap pencarian saat login),
`Appointment.creatorId` dan `Appointment.start` (dipakai bersama oleh query "janji temu
mendatang milik saya" — filter `start >= now()`, diurutkan berdasarkan `start`, untuk user yang
berperan sebagai pembuat atau undangan), dan `AppointmentParticipant.userId`. Yang terakhir ini
gampang terlewat: `AppointmentParticipant` punya primary key komposit di `(appointmentId,
userId)`, yang bisa dipakai Postgres secara efisien untuk pencarian *yang dimulai dari*
`appointmentId` — tapi query "janji temu apa saja yang mengundang user ini" dimulai dari
`userId`, kolom kedua, yang tidak dilayani secara efisien oleh PK komposit. Tanpa
`@@index([userId])` secara eksplisit, separuh dari query "janji temu mendatang" itu akan diam-
diam menurun jadi full scan seiring bertambahnya data.

**Tidak ada N+1, dibuktikan bukan sekadar diasumsikan.** `listForUser()` dicek dengan cara
benar-benar mengaktifkan query logging Prisma (`log: ["query"]`) lalu membaca SQL yang
dihasilkan, bukan dengan menalar secara abstrak. Hasilnya lebih nuansa dari sekadar "satu JOIN":
Prisma client versi ini (dengan driver adapter `@prisma/adapter-pg`) secara default tidak
mengompilasi `include` menjadi satu JOIN SQL — ia mengelompokkan pengambilan relasi menjadi
beberapa query `SELECT ... WHERE id IN (...)` terpisah. Untuk satu halaman daftar janji temu,
itu kurang lebih lima query total (daftar `Appointment` utama, satu batch fetch `User` untuk
para pembuat, satu batch fetch `AppointmentParticipant`, satu batch fetch `User` untuk para
partisipan, ditambah satu `COUNT` untuk pagination) — tapi yang krusial, jumlah query itu
*tetap konstan* berapa pun banyaknya janji temu di halaman tersebut, karena setiap query
lanjutan itu memakai `IN (...)` atas semua ID dari query pertama sekaligus, bukan melakukan
loop dan query ulang per baris. Itulah definisi sebenarnya dari "tidak ada N+1" — Prisma
memenuhinya lewat batching, bukan lewat JOIN literal. (Ada opsi `relationLoadStrategy: 'join'`
kalau suatu saat memang butuh JOIN literal, misalnya untuk satu round-trip ke replika DB jarak
jauh, tapi tidak ada kebutuhan itu di sini.)

**Pagination** di kedua endpoint daftar (`GET /api/users`, `GET /api/appointments`) memakai
`skip`/`take` dengan `pageSize` yang dibatasi (maksimum 50), dipasangkan dengan `count()` dalam
`$transaction` yang sama seperti `findMany()`-nya, supaya total dan isi halaman tetap konsisten
satu sama lain tanpa perlu round-trip kedua.

## 3. Fitur Tambahan

**Autentikasi yang sesungguhnya adalah prioritas #1, sebelum apa pun di daftar ini.** Login
saat ini hanya berbasis username tanpa password atau kredensial apa pun — mengetahui sebuah
username yang valid sudah cukup untuk masuk, sesuai desain brief itu sendiri ("Login dengan
username saja — tanpa field password sama sekali"). Itu wajar sebagai batasan yang memang
disengaja untuk keperluan technical test ini, tapi artinya siapa pun yang tahu (atau menebak)
username `dewi` bisa langsung login sebagai Dewi tanpa pengecekan lain. Untuk produk nyata, ini
butuh kredensial sungguhan — password dengan hashing yang benar (argon2/bcrypt), atau lebih
baik lagi, autentikasi tanpa password lewat kode sekali pakai (OTP) yang dikirim ke email/nomor
yang sudah terverifikasi, yang sekaligus menghindari risiko pemakaian ulang password dan
phishing yang melekat pada password biasa. Ini bukan sekadar nice-to-have; ini satu-satunya
celah yang membuat sistem saat ini belum layak dipakai di luar demo tepercaya.

Di luar itu, kira-kira urutan yang akan saya bangun:

- **Membiarkan partisipan menolak undangan (decline invite).** Saat ini pembuat janji temu
  sudah bisa mengedit dan menghapus (fitur ini baru selesai dibangun setelah draf awal jawaban
  ini), tapi seorang partisipan yang diundang tidak punya cara untuk bilang "saya tidak bisa
  hadir" atau melepaskan diri dari janji temu yang bukan dibuatnya sendiri. Ini masih celah
  nyata untuk sebuah alat penjadwalan, dan merupakan perluasan alami dari arsitektur berlapis
  yang sudah ada (method service baru + route, memakai ulang `validateAppointmentWindow` yang
  sama).
- **Notifikasi** — seorang undangan saat ini hanya tahu ada janji temu kalau ia membuka
  aplikasinya sendiri. Notifikasi email atau push saat diundang/diubah/dibatalkan akan membuat
  fitur "undang user lain" benar-benar berguna di praktiknya, bukan sesuatu yang harus diingat-
  ingat untuk dicek manual.
- **Saran waktu ketika satu slot tidak cocok untuk semua orang.** Aplikasi saat ini sudah
  mendeteksi dan menjelaskan konflik jam kerja (memenuhi standar rubrik "ditangani atau
  diakui"), tapi belum membantu menyelesaikannya. Dengan zona semua partisipan yang sudah
  diketahui, cukup mudah untuk menghitung dan menyarankan jendela waktu yang benar-benar
  overlap (seperti yang sudah dibuktikan ada/tidaknya oleh pengecekan per-zona di `lib/time.ts`)
  alih-alih membiarkan pembuat menebak-nebak secara manual.
- **Foto profil.** Muncul langsung saat membangun halaman pengaturan profil (nama + zona
  waktu) — sengaja ditunda karena butuh penanganan upload file sungguhan dan object storage
  yang persisten (S3/Cloudinary; disk lokal tidak bertahan di sebagian besar target deployment),
  yang jauh lebih banyak infrastrukturnya dibanding fitur lain di aplikasi ini, untuk sebuah
  fitur yang sifatnya kosmetik, bukan fungsional.

## 4. Manajemen Sesi

Payload JWT sengaja dibuat seminimal mungkin: `{ sub, iat, exp }` — id user dan dua timestamp
yang memang dikelola sendiri oleh library `jsonwebtoken`. Tidak ada nama, zona waktu, atau role
yang ikut terbawa, jadi tidak ada bagian dari token yang jadi basi kalau user mengubah profilnya
nanti (yang sekarang bisa mereka lakukan lewat halaman pengaturan), dan tidak ada apa pun yang
berharga untuk diekstrak dari token yang dicuri selain "user id yang mana" — tanpa data pribadi
(PII). Hal lain yang dibutuhkan aplikasi tentang user (nama, zona waktu) selalu diambil segar
dari database di setiap request lewat `getCurrentUser()`, dibungkus `cache()` dari React supaya
pengecekan auth di layout dan pengambilan data di page dalam satu request yang sama tidak
memicu dua kali round-trip ke database.

**Masa berlaku ditegakkan di sisi server, bukan cuma diasumsikan lewat setelan cookie.** Cookie-
nya sendiri memakai `httpOnly` (tidak bisa diakses JS, jadi payload XSS tidak bisa membaca atau
mengeksfiltrasinya), `sameSite=lax` (memblokir cookie ikut terkirim pada POST lintas situs, yang
menutupi sebagian besar kebutuhan perlindungan CSRF di sini tanpa perlu token CSRF terpisah),
dan `secure` yang hanya aktif di production (supaya dev lokal via HTTP tetap jalan) — tapi
`maxAge` pada cookie itu sendiri cuma housekeeping di sisi browser supaya cookie basi akhirnya
tersapu. Penegakan sesungguhnya ada di pengecekan klaim `exp` oleh `jwt.verify()` sendiri, yang
dijalankan di dalam `verifyToken()` pada *setiap* request yang dilindungi, dibungkus try/catch
yang mengubah `TokenExpiredError` (dan kegagalan verifikasi lainnya — signature salah, token
rusak) menjadi `null` yang bersih, bukan exception yang tidak tertangani. Ini diuji langsung,
bukan sekadar diasumsikan: sebuah token yang ditandatangani manual dengan masa berlaku `-1h`,
memakai secret asli, ditolak oleh `/api/auth/me` (401) dan oleh halaman terproteksi (redirect ke
`/login`) — persis sama seolah-olah satu jam sungguhan sudah berlalu — karena `jwt.verify()`
hanya membandingkan `exp` terhadap jam saat ini, ia tidak peduli "bagaimana token itu jadi
basi", jadi ini cara yang benar dan deterministik untuk menguji masa berlaku 1 jam tanpa harus
menunggu satu jam sungguhan.

Satu celah yang terungkap saat pengujian, dan layak disebutkan secara eksplisit: pengecekan auth
di level layout ternyata tidak selalu jalan ulang secara andal saat navigasi client-side antar
halaman sibling di bawah layout yang sama — jadi sesi yang jadi basi di tengah kunjungan
(user id di baliknya sudah tidak valid lagi) bisa membuat sebuah halaman crash alih-alih
redirect, kalau layout dijadikan satu-satunya pengecekan. Perbaikannya adalah mengecek
`getCurrentUser()` lagi di setiap halaman satu per satu, bukan hanya di layout bersama — sedikit
kurang DRY, tapi memang itu tempat yang benar untuk pengecekan otorisasi menurut panduan
Next.js sendiri, dan sudah dikonfirmasi dengan mereproduksi kegagalan persisnya sebelum
perbaikan, lalu memastikan kegagalan itu hilang sesudahnya.
