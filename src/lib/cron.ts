// src/lib/cron.ts
import cron from "node-cron";

let schedulerStarted = false;
let scheduledJob: cron.ScheduledTask | null = null;

export function startPemiluScheduler() {
  // Cegah multiple instance di process yang sama
  if (schedulerStarted) {
    console.log("⚠️ Pemilu scheduler already running in this process");
    return;
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error("❌ CRON_SECRET not found in .env");
    return;
  }

  // Cron: setiap 10 detik
  scheduledJob = cron.schedule("*/10 * * * * *", async () => {
    try {
      const response = await fetch(`${baseUrl}/api/cron/pemilu-scheduler`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${cronSecret}`,
        },
      });

      if (!response.ok) {
        console.error(`❌ Scheduler failed: ${response.status}`);
        return;
      }

      const result = await response.json();

      if (result.started?.length > 0) {
        console.log("✅ Started pemilu:", result.started);
      }

      if (result.transitioned?.length > 0) {
        console.log("✅ Transitioned giliran:", result.transitioned);
      }

      if (!result.started?.length && !result.transitioned?.length) {
        console.log("ℹ️ No action needed");
      }
    } catch (error) {
      console.error("❌ Scheduler error:", error);
    }
  });

  schedulerStarted = true;
  console.log("🚀 Pemilu scheduler started (runs every 10 seconds)");
}

// OPTIONAL: fungsi untuk berhenti (kalau kamu butuh)
export function stopPemiluScheduler() {
  if (scheduledJob) {
    scheduledJob.stop();
    scheduledJob = null;
    schedulerStarted = false;
    console.log("🛑 Pemilu scheduler stopped");
  }
}

/**
 * ⚠️ PENTING:
 * Di Next.js, auto-start di import bisa bikin multiple instance
 * (karena dev server / hot reload / lambdas).
 * Lebih aman panggil `startPemiluScheduler()` hanya di:
 * - custom server (server.js),
 * - atau 1 tempat terkontrol di environment production.
 *
 * Untuk dev, SEBAIKNYA JANGAN auto-start dari sini.
 */

// HAPUS / KOMENTARI blok ini untuk menghindari multiple instance:
// if (typeof window === "undefined") {
//   startPemiluScheduler();
// }
