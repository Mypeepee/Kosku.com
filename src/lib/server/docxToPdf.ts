// src/lib/server/docxToPdf.ts
// ---------------------------------------------------------------------------
// SERVER-ONLY. Konversi .docx → .pdf lewat LibreOffice headless — satu mesin
// untuk ketujuh route pembuat surat di src/app/api/surat/.
//
// KENAPA BERKAS INI ADA
// findSoffice() + docxToPdf() dulu disalin utuh di tujuh route, dan salinannya
// sudah menyimpang: tiga route tahu lokasi LibreOffice di Windows, empat tidak.
// Jadi perbaikan lokasi biner harus ditempel tujuh kali dan mudah terlewat.
//
// KENAPA PENCARIANNYA JAUH LEBIH LUAS DARIPADA "/usr/bin/soffice"
// Produksi jalan di shared cPanel: TIDAK ADA akses root, jadi LibreOffice tidak
// akan pernah mendarat di /usr/bin — satu-satunya jalan adalah paket portable
// yang diekstrak ke folder home (mis. ~/opt/libreoffice25.2/program/soffice).
// Karena nomor versinya ikut nama folder dan berubah tiap rilis, path-nya tidak
// bisa ditulis mati; makanya ada sapuan HOME + penelusuran PATH di bawah.
//
// KENAPA PROFIL & ANTREAN DIURUS
// LibreOffice butuh direktori profil yang bisa ditulis. Bawaannya
// $HOME/.config/libreoffice — di shared hosting sering tidak siap, dan dua
// konversi bersamaan akan berebut kunci profil yang sama lalu menggantung
// diam-diam. Di sini profilnya dipaksa ke satu folder tmp milik aplikasi dan
// konversi dijalankan bergiliran: lebih aman di jatah RAM shared hosting, dan
// profilnya dipakai ulang sehingga tidak dibangun ulang tiap surat.
// ---------------------------------------------------------------------------

import { accessSync, constants, existsSync, readdirSync, statSync } from "fs";
import { mkdtemp, readFile, rm, writeFile } from "fs/promises";
import { execFile } from "child_process";
import { promisify } from "util";
import { homedir, tmpdir } from "os";
import { delimiter, join } from "path";
import { pathToFileURL } from "url";

const execFileAsync = promisify(execFile);

// Konversi dokumen sepanjang beberapa halaman biasanya < 5 detik. Batas ini ada
// untuk kasus soffice menggantung (profil rusak, kehabisan memori): request
// route punya maxDuration 60 detik, jadi kita harus menyerah lebih dulu agar
// pemanggilnya masih sempat menerima pesan error yang jelas.
const BATAS_WAKTU_MS = 45_000;

const NAMA_BIN = process.platform === "win32"
  // soffice.com dipakai lebih dulu di Windows: soffice.exe bisa melepas diri
  // (detach) sehingga proses "selesai" sebelum PDF-nya benar-benar ditulis.
  ? ["soffice.com", "soffice.exe", "soffice"]
  : ["soffice"];

// Profil dipakai ulang lintas request dalam satu proses Node.
const PROFIL_DIR = join(tmpdir(), "lo-profil-solusindoaset");

function bisaDieksekusi(p: string): boolean {
  try {
    if (!statSync(p).isFile()) return false;
    accessSync(p, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

/** Telusuri PATH — menangkap LibreOffice portable yang sudah dipasang di PATH. */
function dariPath(): string[] {
  const path = process.env.PATH;
  if (!path) return [];
  const hasil: string[] = [];
  for (const dir of path.split(delimiter)) {
    if (!dir) continue;
    for (const nama of NAMA_BIN) {
      const p = join(dir, nama);
      if (bisaDieksekusi(p)) hasil.push(p);
    }
  }
  return hasil;
}

/**
 * Sapu folder-folder yang mungkin memuat LibreOffice portable.
 * Hanya menuruni direktori bernama "opt"/"lo" atau berawalan "libreoffice",
 * jadi ini bukan penelusuran seluruh home — cukup murah untuk dijalankan sekali.
 */
function sapu(akar: string, sisaKedalaman: number, hasil: string[]): void {
  for (const nama of NAMA_BIN) {
    const p = join(akar, "program", nama);
    if (bisaDieksekusi(p)) hasil.push(p);
  }
  if (sisaKedalaman <= 0) return;
  let isi;
  try {
    isi = readdirSync(akar, { withFileTypes: true });
  } catch {
    return; // tidak ada / tidak boleh dibaca — bukan error, lanjut kandidat lain
  }
  for (const e of isi) {
    if (!e.isDirectory() && !e.isSymbolicLink()) continue;
    const n = e.name.toLowerCase();
    if (n === "opt" || n === "lo" || n.startsWith("libreoffice")) {
      sapu(join(akar, e.name), sisaKedalaman - 1, hasil);
    }
  }
}

/** Semua kandidat lokasi soffice, urut dari yang paling dipercaya. */
export function kandidatSoffice(): string[] {
  const home = process.env.HOME || homedir();
  const hasil: string[] = [];

  // 1. Setelan eksplisit selalu menang.
  if (process.env.SOFFICE_PATH && bisaDieksekusi(process.env.SOFFICE_PATH)) {
    hasil.push(process.env.SOFFICE_PATH);
  }

  // 2. Lokasi baku hasil installer (butuh root di Linux).
  const baku = [
    "C:/Program Files/LibreOffice/program/soffice.com",
    "C:/Program Files (x86)/LibreOffice/program/soffice.com",
    "C:/Program Files/LibreOffice/program/soffice.exe",
    "C:/Program Files (x86)/LibreOffice/program/soffice.exe",
    "/Applications/LibreOffice.app/Contents/MacOS/soffice",
    "/usr/bin/soffice",
    "/usr/local/bin/soffice",
    "/opt/libreoffice/program/soffice",
  ];
  for (const p of baku) if (bisaDieksekusi(p)) hasil.push(p);

  // 3. PATH.
  hasil.push(...dariPath());

  // 4. Paket portable di folder home — inilah jalur shared cPanel.
  for (const akar of [join(home, "opt"), join(home, "libreoffice"), join(home, "lo"), home, "/opt"]) {
    sapu(akar, 3, hasil);
  }

  return [...new Set(hasil)];
}

let terpilih: string | null = null;

export function findSoffice(): string {
  if (terpilih && bisaDieksekusi(terpilih)) return terpilih;
  const [pertama] = kandidatSoffice();
  if (!pertama) {
    throw new Error(
      "LibreOffice (soffice) tidak ditemukan di server ini. " +
      "Pasang LibreOffice portable di folder home lalu set SOFFICE_PATH " +
      "(mis. SOFFICE_PATH=/home/USER/opt/libreoffice25.2/program/soffice) " +
      "pada environment variable aplikasi Node di cPanel, lalu Restart App. " +
      "Cek dengan GET /api/diagnostik/soffice.",
    );
  }
  terpilih = pertama;
  return pertama;
}

// Konversi dijalankan bergiliran: satu profil LibreOffice tidak boleh dipakai
// dua proses sekaligus, dan shared hosting tidak punya RAM untuk dua soffice.
let antrean: Promise<unknown> = Promise.resolve();

function bergiliran<T>(tugas: () => Promise<T>): Promise<T> {
  const hasil = antrean.then(tugas, tugas);
  antrean = hasil.catch(() => {});
  return hasil;
}

async function jalankan(soffice: string, kerja: string, docxPath: string): Promise<void> {
  await execFileAsync(
    soffice,
    [
      `-env:UserInstallation=${pathToFileURL(PROFIL_DIR).href}`,
      "--headless",
      "--norestore",
      "--nolockcheck",
      "--nodefault",
      "--nologo",
      "--nofirststartwizard",
      "--convert-to", "pdf",
      "--outdir", kerja,
      docxPath,
    ],
    {
      timeout: BATAS_WAKTU_MS,
      killSignal: "SIGKILL",
      maxBuffer: 10 * 1024 * 1024,
      // HOME wajib ada & bisa ditulis; kalau tidak, LibreOffice mati tanpa pesan.
      env: { ...process.env, HOME: process.env.HOME || tmpdir() },
    },
  );
}

/**
 * Isi buffer .docx → buffer .pdf.
 * `prefix` hanya menamai folder kerja sementara (memudahkan pelacakan).
 */
export async function docxToPdf(docxBuffer: Buffer, prefix = "surat"): Promise<Buffer> {
  const soffice = findSoffice();

  return bergiliran(async () => {
    const kerja = await mkdtemp(join(tmpdir(), `${prefix}-`));
    const docxPath = join(kerja, "dokumen.docx");
    const pdfPath = join(kerja, "dokumen.pdf");

    try {
      await writeFile(docxPath, docxBuffer);

      try {
        await jalankan(soffice, kerja, docxPath);
      } catch (e) {
        // Percobaan kedua dengan profil bersih: sisa kunci dari proses yang mati
        // mendadak adalah penyebab paling sering konversi gagal/menggantung.
        await rm(PROFIL_DIR, { recursive: true, force: true }).catch(() => {});
        await jalankan(soffice, kerja, docxPath).catch(() => { throw e; });
      }

      if (!existsSync(pdfPath)) {
        throw new Error(
          `LibreOffice selesai tetapi tidak menghasilkan PDF (${soffice}). ` +
          "Biasanya template .docx-nya rusak atau memori server tidak cukup.",
        );
      }
      return await readFile(pdfPath);
    } finally {
      await rm(kerja, { recursive: true, force: true }).catch(() => {});
    }
  });
}

/** Laporan untuk /api/diagnostik/soffice — dijalankan DI server yang bermasalah. */
export async function periksaSoffice(): Promise<{
  ok: boolean;
  terpakai: string | null;
  kandidat: string[];
  versi: string | null;
  soffice_path_env: string | null;
  home: string;
  tmp: string;
  platform: string;
  pesan: string;
}> {
  const kandidat = kandidatSoffice();
  const home = process.env.HOME || homedir();
  const dasar = {
    kandidat,
    soffice_path_env: process.env.SOFFICE_PATH ?? null,
    home,
    tmp: tmpdir(),
    platform: `${process.platform}/${process.arch}`,
  };

  if (kandidat.length === 0) {
    return {
      ...dasar,
      ok: false,
      terpakai: null,
      versi: null,
      pesan:
        "Tidak ada soffice yang bisa dieksekusi. Pasang LibreOffice portable di " +
        `${join(home, "opt")} lalu set SOFFICE_PATH dan Restart App.`,
    };
  }

  const terpakai = kandidat[0];
  try {
    const { stdout } = await execFileAsync(terpakai, ["--version"], {
      timeout: 20_000,
      killSignal: "SIGKILL",
      env: { ...process.env, HOME: process.env.HOME || tmpdir() },
    });
    return { ...dasar, ok: true, terpakai, versi: stdout.trim(), pesan: "LibreOffice siap dipakai." };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ...dasar,
      ok: false,
      terpakai,
      versi: null,
      // Binernya ada tapi tidak mau jalan — hampir selalu library sistem kurang.
      pesan: `Biner ditemukan tapi gagal dijalankan: ${msg}`,
    };
  }
}
