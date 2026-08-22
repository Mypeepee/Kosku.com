// Module-level singleton untuk state scrape job.
// Job hidup di server memori, terpisah dari koneksi SSE client → user
// bisa pindah page tanpa mematikan scraping. Cancel hanya lewat .cancel().

export type LogEvent =
  | { type: "log"; msg: string }
  | {
      type: "saved";
      msg: string;
      judul: string;
      kota: string;
      /** Sudah dikirim scraper sejak lama, tapi belum pernah masuk tipe ini. */
      alamat_lengkap?: string | null;
      harga: number;
      gambar: string | null;
      totalSaved: number;
    }
  | {
      type: "progress";
      page: number;
      totalSaved: number;
      totalSkipped: number;
    }
  | { type: "error"; msg: string }
  | {
      type: "done" | "cancelled";
      totalSaved: number;
      totalSkipped: number;
      page: number;
    };

export type JobStatus = "running" | "done" | "error" | "cancelled";

export interface ScrapeJobState {
  id: string;
  kategori: string;
  startPage: number;
  agentId: string;
  status: JobStatus;
  logs: LogEvent[];
  totalSaved: number;
  totalSkipped: number;
  currentPage: number;
  cancelled: boolean;
  startedAt: number;
  finishedAt?: number;
}

const MAX_LOGS = 1000;

class ScrapeJobManager {
  private job: ScrapeJobState | null = null;
  private subscribers = new Set<(event: LogEvent) => void>();

  get current(): ScrapeJobState | null {
    return this.job;
  }

  /** Mulai job baru. Return null kalau sudah ada job yang masih running. */
  start(input: {
    kategori: string;
    startPage: number;
    agentId: string;
  }): ScrapeJobState | null {
    if (this.job && this.job.status === "running") return null;
    this.subscribers.clear();
    this.job = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      kategori: input.kategori,
      startPage: input.startPage,
      agentId: input.agentId,
      status: "running",
      logs: [],
      totalSaved: 0,
      totalSkipped: 0,
      currentPage: input.startPage,
      cancelled: false,
      startedAt: Date.now(),
    };
    return this.job;
  }

  /** Push event ke buffer + fan-out ke semua subscribers. */
  push(event: LogEvent): void {
    if (!this.job) return;

    this.job.logs.push(event);
    if (this.job.logs.length > MAX_LOGS) this.job.logs.shift();

    // Update aggregates dari event terminal
    if (event.type === "saved") {
      this.job.totalSaved = event.totalSaved;
    } else if (event.type === "progress") {
      this.job.currentPage = event.page;
      this.job.totalSaved = event.totalSaved;
      this.job.totalSkipped = event.totalSkipped;
    } else if (event.type === "done" || event.type === "cancelled") {
      this.job.status = event.type;
      this.job.totalSaved = event.totalSaved;
      this.job.totalSkipped = event.totalSkipped;
      this.job.finishedAt = Date.now();
    } else if (event.type === "error") {
      this.job.status = "error";
      this.job.finishedAt = Date.now();
    }

    for (const fn of this.subscribers) {
      try {
        fn(event);
      } catch {}
    }
  }

  /** Set cancellation flag. Loop scraping akan break di check point berikutnya. */
  cancel(): boolean {
    if (this.job && this.job.status === "running") {
      this.job.cancelled = true;
      return true;
    }
    return false;
  }

  /** Subscribe to live events. Return unsubscribe fn. */
  subscribe(fn: (event: LogEvent) => void): () => void {
    this.subscribers.add(fn);
    return () => {
      this.subscribers.delete(fn);
    };
  }

  /** Apakah job sedang aktif. */
  isRunning(): boolean {
    return this.job?.status === "running";
  }
}

// Singleton — persist across requests dalam Node.js process.
// Pakai globalThis agar hot-reload di Next.js dev tidak buat instance baru.
const globalKey = "__SCRAPE_JOB_MANAGER__";
const g = globalThis as unknown as { [k: string]: ScrapeJobManager };
export const scrapeJobManager: ScrapeJobManager =
  g[globalKey] ?? (g[globalKey] = new ScrapeJobManager());
