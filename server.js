// server.js
// Force production mode — cPanel NodeJS Selector does not always inject NODE_ENV
process.env.NODE_ENV = process.env.NODE_ENV || 'production';

const { createServer } = require('http')
const { parse } = require('url')
const next = require('next')

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
// Default 3000 agar cocok dengan ingress Cloudflare tunnel (solusindoaset.com
// → http://localhost:3000). Bisa ditimpa lewat env PORT (mis. di cPanel).
const port = process.env.PORT || process.env.port || 3000
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

// Scheduler in-process: PENGINGAT ACARA (H-3 jam).
// cPanel menjalankan satu proses `node server.js`, jadi aman tanpa risiko
// multi-instance. Tiap 15 menit memanggil endpoint /api/cron/acara-reminder;
// endpoint itu yang menentukan acara mana yang jatuh dalam jendela 3 jam,
// mengirim email ke pembuat + peserta, lalu menandai reminder_sent.
function startAcaraReminderScheduler(port) {
  let cron
  try {
    cron = require('node-cron')
  } catch (e) {
    console.error('[acara-reminder] node-cron tidak tersedia:', e.message)
    return
  }
  const http = require('http')
  const cronSecret = process.env.CRON_SECRET || ''

  const trigger = () => {
    const reqRem = http.request(
      {
        hostname: 'localhost',
        port,
        path: '/api/cron/acara-reminder',
        method: 'GET',
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      },
      (r) => {
        let body = ''
        r.on('data', (c) => (body += c))
        r.on('end', () => {
          try {
            const j = JSON.parse(body || '{}')
            if (j.emailsSent || j.eventsFailed) {
              console.log(
                `[acara-reminder] terkirim=${j.emailsSent} gagal=${j.eventsFailed} total=${j.totalAcara}`,
              )
            }
          } catch (_) {}
        })
      },
    )
    reqRem.on('error', (e) => console.error('[acara-reminder] error:', e.message))
    reqRem.end()
  }

  cron.schedule('*/15 * * * *', trigger)
  console.log('> Scheduler pengingat acara aktif (cek tiap 15 menit)')
}

// Scheduler in-process: ASISTEN PREFERENSI KLIEN.
// DUA jadwal dengan harga yang sangat berbeda, jadi sengaja dipisah:
//   • tiap 15 menit → ?jenis=perubahan. Satu JOIN yang membandingkan harga
//     aset terkirim dengan harga yang terakhir diketahui klien. Murah, dan
//     harus sering: harga turun yang baru diketahui tiga hari kemudian bukan
//     lagi peluang.
//   • tiap 2 jam, 08–20 → ?jenis=asetbaru. Memindai listing yang BARU masuk
//     terhadap setiap preferensi klien, lalu mengirim satu email digest per
//     agent berisi tombol satu-ketukan ke WhatsApp. Berhenti pada satu COUNT
//     bila tidak ada listing baru, jadi di kantor yang sepi harganya nyaris
//     nol. Emailnya sendiri direm 6 jam sekali per agent DI DATABASE — irama
//     pemindaian dan irama pemberitahuan sengaja berbeda.
//   • 07.30 tiap hari → ?jenis=harian. Pemindaian aset baru berjendela penuh
//     sehari (menangkap yang jatuh di jam tenang) plus pencarian klien yang
//     didiamkan. Mahal, dan tidak perlu sering — daftar tugas pagi memang
//     dibaca sekali di pagi hari.
// Endpoint-lah yang memegang seluruh ambang & rem; berkas ini hanya jam weker.
function startAsistenKlienScheduler(port) {
  let cron
  try {
    cron = require('node-cron')
  } catch (e) {
    console.error('[asisten-klien] node-cron tidak tersedia:', e.message)
    return
  }
  const http = require('http')
  const cronSecret = process.env.CRON_SECRET || ''

  // Endpoint asisten MENOLAK permintaan tanpa secret di produksi. Kalau
  // variabelnya kosong di sini, seluruh penjadwalan ini akan menembak dan
  // menerima 401 tiap 15 menit — selamanya, tanpa satu pun email terkirim dan
  // tanpa satu pun keluhan di log. Diberitahukan sekali, keras, saat start.
  if (!cronSecret && process.env.NODE_ENV === 'production') {
    console.error(
      '[asisten-klien] CRON_SECRET kosong di proses ini. Endpoint akan menolak ' +
      'semua panggilan dan asisten klien TIDAK akan mengirim apa pun. ' +
      'Isi CRON_SECRET di environment lalu jalankan ulang.',
    )
  }

  const trigger = (jenis) => () => {
    const r = http.request(
      {
        hostname: 'localhost',
        port,
        path: `/api/cron/rekomendasi-klien?jenis=${jenis}`,
        method: 'GET',
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          // Status non-200 (401 karena secret salah, 500 karena rute belum
          // ter-build) sebelumnya lolos tanpa jejak: kodenya hanya membaca
          // `j.ok`, sementara 401 memakai `message`, bukan `error`.
          if (res.statusCode !== 200) {
            console.error(`[asisten-klien:${jenis}] HTTP ${res.statusCode}:`, body.slice(0, 200))
            return
          }
          try {
            const j = JSON.parse(body || '{}')
            if (j.ok === false) {
              console.error(`[asisten-klien:${jenis}] gagal:`, j.error || j.message)
              return
            }
            // Diam kalau tidak ada yang terjadi. Log yang berisi "0 0 0" tiap
            // 15 menit membuat log yang benar-benar penting tidak terlihat.
            const tugas = (j.perubahan?.tugasDibuat || 0) + (j.asetBaru?.tugasDibuat || 0) + (j.klienSepi?.tugasDibuat || 0)
            const email = j.kabarAsetBaru?.email || 0
            if (tugas > 0 || email > 0) {
              console.log(`[asisten-klien:${jenis}] tugas=${tugas} email=${email} (${j.durasiMs}ms)`)
            }
          } catch (_) {}
        })
      },
    )
    r.on('error', (e) => console.error(`[asisten-klien:${jenis}] error:`, e.message))
    r.end()
  }

  cron.schedule('*/15 * * * *', trigger('perubahan'))
  cron.schedule('0 8-20/2 * * *', trigger('asetbaru'))
  cron.schedule('30 7 * * *', trigger('harian'))
  console.log('> Scheduler asisten klien aktif (perubahan /15 mnt, aset baru /2 jam 08-20, harian 07.30)')
}

// Scheduler in-process: PEMINDAI "DEKAT APA".
// Aset hasil scraper lelang masuk tanpa data landmark, dan sebelum ini
// satu-satunya pemicunya adalah seseorang MEMBUKA halaman aset itu — sehingga
// pengunjung pertama (sering kali klien yang baru dikirimi tautan) yang
// menanggung tunggu puluhan detik. Penjadwal ini mengerjakannya lebih dulu di
// latar. Tiap putaran berjatah WAKTU, bukan jumlah aset: satu aset bisa 2 detik
// atau 70 detik, jadi batas jumlah tidak bisa diprediksi.
// Jam kerja saja (07–22) supaya tidak menambah beban di jam pemeliharaan, dan
// tiap 10 menit supaya antrean besar tetap habis dalam hitungan hari tanpa
// pernah menembak Overpass beruntun.
function startPindaiSekitarScheduler(port) {
  let cron
  try {
    cron = require('node-cron')
  } catch (e) {
    console.error('[pindai-sekitar] node-cron tidak tersedia:', e.message)
    return
  }
  const http = require('http')
  const cronSecret = process.env.CRON_SECRET || ''

  let sedangJalan = false
  const trigger = () => {
    // Putaran bisa memakan empat menit; tanpa penjaga ini, jadwal 10 menit yang
    // kebetulan melambat akan menumpuk putaran di atas putaran.
    if (sedangJalan) return
    sedangJalan = true

    const r = http.request(
      {
        hostname: 'localhost',
        port,
        path: '/api/cron/pindai-sekitar?detik=240',
        method: 'GET',
        headers: cronSecret ? { Authorization: `Bearer ${cronSecret}` } : {},
      },
      (res) => {
        let body = ''
        res.on('data', (c) => (body += c))
        res.on('end', () => {
          sedangJalan = false
          if (res.statusCode !== 200) {
            console.error(`[pindai-sekitar] HTTP ${res.statusCode}:`, body.slice(0, 200))
            return
          }
          try {
            const j = JSON.parse(body || '{}')
            // Diam kalau tidak ada pekerjaan. Log "0 0 0" tiap 10 menit membuat
            // log yang benar-benar penting tidak terlihat.
            if (j.diproses > 0) {
              console.log(
                `[pindai-sekitar] ${j.diproses} aset · lengkap=${j.lengkap} ` +
                `sebagian=${j.sebagian} gagal=${j.gagal} · sisa=${j.sisaAntrean} (${j.durasiMs}ms)`,
              )
            }
          } catch (_) {}
        })
      },
    )
    r.on('error', (e) => { sedangJalan = false; console.error('[pindai-sekitar] error:', e.message) })
    r.end()
  }

  cron.schedule('*/10 7-22 * * *', trigger)
  console.log('> Scheduler pemindai sekitar aktif (tiap 10 menit, 07-22)')
}

app.prepare().then(() => {
  createServer(async (req, res) => {
    try {
      // Be sure to pass `true` as the second argument to `url.parse`.
      // This tells it to parse the query portion of the URL.
      const parsedUrl = parse(req.url, true)
      const { pathname, query } = parsedUrl

      if (pathname === '/a') {
        await app.render(req, res, '/a', query)
      } else if (pathname === '/b') {
        await app.render(req, res, '/b', query)
      } else {
        await handle(req, res, parsedUrl)
      }
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  }).listen(port, (err) => {
    if (err) throw err
    console.log(`> Ready on http://${hostname}:${port}`)
    startAcaraReminderScheduler(port)
    startAsistenKlienScheduler(port)
    startPindaiSekitarScheduler(port)
  })
})