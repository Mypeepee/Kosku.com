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
  })
})