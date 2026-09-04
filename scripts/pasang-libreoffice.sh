#!/usr/bin/env bash
# scripts/pasang-libreoffice.sh
# ---------------------------------------------------------------------------
# Pasang LibreOffice PORTABLE ke folder home — untuk shared cPanel yang TIDAK
# punya akses root, sehingga `yum install libreoffice` mustahil.
#
# Caranya: unduh paket resmi LibreOffice lalu bongkar isinya ke dalam home
# (bukan ke /usr atau /opt). Tidak ada yang dipasang ke sistem, tidak ada yang
# butuh sudo. Hasil akhirnya satu path yang tinggal dipasang sebagai
# SOFFICE_PATH di environment variable aplikasi Node cPanel.
#
# PAKAI (di SSH atau Terminal cPanel):
#   bash scripts/pasang-libreoffice.sh
#
# Butuh sekitar 1,5 GB ruang disk dan ~10 menit. Kalau kuota disk atau inode
# hampir penuh, batalkan — LibreOffice memuat puluhan ribu berkas kecil.
# ---------------------------------------------------------------------------
set -euo pipefail

# Versinya TIDAK ditulis mati: mirror resmi hanya menyimpan branch stabil yang
# sedang berjalan, jadi nomor yang di-hardcode akan berubah jadi 404 dalam
# hitungan bulan. Timpa dengan LO_VERSI=26.2.5 kalau perlu versi tertentu.
VERSI="${LO_VERSI:-}"
TUJUAN="${LO_TUJUAN:-$HOME/opt}"
UNDUHAN="$(mktemp -d)"
trap 'rm -rf "$UNDUHAN"' EXIT

INDEKS="https://download.documentfoundation.org/libreoffice/stable/"
echo "==> LibreOffice portable → $TUJUAN"

# --- 1. Prasyarat -----------------------------------------------------------
# Hosting yang mengunci shell (jailed shell tanpa curl/tar) tidak bisa dilayani
# skrip ini; lebih baik ketahuan sekarang daripada setelah unduhan 300 MB.
for alat in tar; do
  command -v "$alat" >/dev/null || { echo "!! '$alat' tidak ada di server ini." >&2; exit 1; }
done
if command -v curl >/dev/null; then AMBIL=(curl -fL -o)
elif command -v wget >/dev/null; then AMBIL=(wget -O)
else echo "!! butuh curl atau wget." >&2; exit 1; fi

if [ -z "$VERSI" ]; then
  echo "==> cari versi stabil terbaru"
  # Kurung kurawal luar wajib: tanpa itu `A || B | grep` diurai sebagai
  # `A || (B | grep)`, sehingga keluaran curl yang berhasil lolos tanpa disaring.
  VERSI="$(
    {
      { command -v curl >/dev/null && curl -sfL --max-time 30 "$INDEKS"; } \
        || wget -qO- --timeout=30 "$INDEKS"
    } | grep -oE '[0-9]+\.[0-9]+\.[0-9]+/' | tr -d '/' | sort -u -V | tail -n1
  )"
  [ -n "$VERSI" ] || { echo "!! gagal membaca daftar versi dari $INDEKS. Set LO_VERSI=26.2.5 lalu ulangi." >&2; exit 1; }
  echo "==> versi terbaru: $VERSI"
fi

ARSITEKTUR="$(uname -m)"
[ "$ARSITEKTUR" = "x86_64" ] || echo "!! arsitektur $ARSITEKTUR — paket di bawah untuk x86_64, kemungkinan gagal." >&2

# --- 2. Pilih format paket sesuai distro ------------------------------------
# cPanel hampir selalu CloudLinux/AlmaLinux (RPM). Debian/Ubuntu disediakan
# untuk VPS yang kebetulan memakai skrip yang sama.
if command -v rpm2cpio >/dev/null && command -v cpio >/dev/null; then
  FORMAT="rpm"
elif command -v dpkg-deb >/dev/null; then
  FORMAT="deb"
elif command -v ar >/dev/null; then
  FORMAT="deb-ar"
else
  echo "!! tidak ada rpm2cpio+cpio maupun dpkg-deb/ar untuk membongkar paket." >&2
  echo "   Minta hosting memasang LibreOffice, atau tempuh opsi konversi eksternal." >&2
  exit 1
fi
echo "==> format paket: $FORMAT"

case "$FORMAT" in
  rpm) BERKAS="LibreOffice_${VERSI}_Linux_x86-64_rpm.tar.gz"; SUB="rpm" ;;
  *)   BERKAS="LibreOffice_${VERSI}_Linux_x86-64_deb.tar.gz"; SUB="deb" ;;
esac
URL="${INDEKS}${VERSI}/${SUB}/x86_64/${BERKAS}"

# --- 3. Unduh & bongkar -----------------------------------------------------
echo "==> unduh $URL"
"${AMBIL[@]}" "$UNDUHAN/$BERKAS" "$URL"

echo "==> buka arsip"
tar -xzf "$UNDUHAN/$BERKAS" -C "$UNDUHAN"

mkdir -p "$TUJUAN"
cd "$TUJUAN"

# Paket bahasa & berkas bantuan tidak dipakai untuk konversi headless; dilewati
# supaya hemat ratusan MB dan puluhan ribu inode.
echo "==> pasang berkas program (melewati paket bahasa & bantuan)"
JUMLAH=0
while IFS= read -r paket; do
  case "$(basename "$paket")" in
    *langpack*|*helppack*|*sdk*|*debuginfo*) continue ;;
  esac
  case "$FORMAT" in
    rpm)    rpm2cpio "$paket" | cpio -idm --quiet ;;
    deb)    dpkg-deb -x "$paket" . ;;
    deb-ar) ( cd "$TUJUAN" && ar p "$paket" data.tar.xz 2>/dev/null | tar -xJ || \
              ar p "$paket" data.tar.gz | tar -xz ) ;;
  esac
  JUMLAH=$((JUMLAH + 1))
done < <(find "$UNDUHAN" -name "*.${FORMAT%%-*}" -type f | sort)

echo "==> $JUMLAH paket dibongkar"

# --- 4. Temukan binernya ----------------------------------------------------
SOFFICE="$(find "$TUJUAN" -type f -name soffice -path '*/program/*' 2>/dev/null | head -n1 || true)"
if [ -z "$SOFFICE" ]; then
  echo "!! soffice tidak ketemu setelah pembongkaran. Periksa isi $TUJUAN." >&2
  exit 1
fi
chmod +x "$SOFFICE" 2>/dev/null || true

# --- 5. Uji betulan ---------------------------------------------------------
# Biner yang ada belum tentu jalan: shared hosting kadang kurang library sistem
# (libX11, libcairo, fontconfig). Lebih baik gagal di sini, dengan pesan asli
# dari loader, daripada gagal diam-diam saat user menekan tombol Generate.
echo "==> uji jalan"
PROFIL="$(mktemp -d)"
if ! "$SOFFICE" "-env:UserInstallation=file://$PROFIL" --headless --version; then
  echo "!! biner ada tapi tidak mau jalan — kemungkinan library sistem kurang." >&2
  echo "   Jalankan 'ldd $SOFFICE' untuk melihat yang hilang." >&2
  rm -rf "$PROFIL"; exit 1
fi
rm -rf "$PROFIL"

cat <<PESAN

────────────────────────────────────────────────────────────────────────
BERHASIL. Langkah terakhir, di cPanel → Setup Node.js App → aplikasimu:

  1. Tambah Environment Variable:
         SOFFICE_PATH = $SOFFICE
  2. Klik RESTART APP (wajib — proses lama tidak melihat variabel baru).
  3. Pastikan:
         curl "https://solusindoaset.com/api/diagnostik/soffice?secret=\$CRON_SECRET"

Kalau langkah 3 menjawab {"ok":true,...}, tombol Generate surat sudah hidup.
────────────────────────────────────────────────────────────────────────
PESAN
