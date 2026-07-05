// Preview generator for the event-reminder email. Run: npx tsx scripts/preview-reminder.mjs
import { writeFileSync } from "node:fs";
import { agentEventReminderEmailHtml } from "../src/lib/mailer.ts";

const start = new Date("2026-07-06T10:00:00+07:00"); // Senin, 10:00 WIB
const end = new Date("2026-07-06T11:00:00+07:00"); // 11:00 WIB
const now = new Date("2026-07-06T07:00:00+07:00"); // dikirim H-3 jam (07:00)

const html = agentEventReminderEmailHtml({
  agentName: "Bapak Sujatmiko",
  eventTitle: "Open House — Cluster Graha Family",
  startAt: start,
  endAt: end,
  category: "Open House",
  location: "Jl. Bukit Darmo Golf No. 12, Surabaya",
  locationUrl: "https://maps.google.com/?q=Graha+Family+Surabaya",
  notes: "Bawa brosur cetak & banner. Calon pembeli: Ibu Wulandari (2 orang).",
  detailUrl: "https://solusindoaset.com/dashboard#kalender",
  now,
});

writeFileSync("public/templates/preview-reminder-acara.html", html);
console.log("✅ Preview ditulis ke public/templates/preview-reminder-acara.html");
