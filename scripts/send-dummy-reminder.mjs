// Kirim SATU email pengingat acara DUMMY untuk uji tampilan + deliverability.
// Jalankan: npx tsx scripts/send-dummy-reminder.mjs [email-tujuan]
import dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

// Import setelah env dimuat (mailer membaca process.env saat module load).
const { sendAgentEventReminderEmail } = await import("../src/lib/mailer.ts");

const to = process.argv[2] || "jasoncliendo@gmail.com";
const now = new Date();
const start = new Date(now.getTime() + 3 * 60 * 60 * 1000); // mulai 3 jam lagi
const end = new Date(start.getTime() + 60 * 60 * 1000); // durasi 1 jam
const lokasi = "Jl. Bukit Darmo Golf No. 12, Surabaya";

const res = await sendAgentEventReminderEmail(to, {
  agentName: "Bapak Sujatmiko",
  eventTitle: "Open House — Cluster Graha Family",
  startAt: start,
  endAt: end,
  category: "Open House",
  location: lokasi,
  locationUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lokasi)}`,
  notes: "Ini email DUMMY untuk menguji tampilan & pengiriman pengingat acara.",
  detailUrl: "https://solusindoaset.com/dashboard#kalender",
  now,
});

console.log(res.delivered ? `✅ Terkirim ke ${to}` : `❌ Gagal kirim ke ${to}`);
