// src/lib/leadTracking.ts
// Client-side helper untuk capture lead saat user klik WA / Telepon / Survei
// di detail listing properti. Tidak ada popup — silent tracking.

const SESSION_KEY = "kosku_lead_session";

function getSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(SESSION_KEY);
    if (!id) {
      id =
        "sess_" +
        Math.random().toString(36).slice(2, 10) +
        Date.now().toString(36);
      window.localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

export interface TrackLeadClickInput {
  id_property: string | number | bigint;
  id_agent?: string;
  source:
    | "whatsapp"
    | "telepon"
    | "survei"
    | "penawaran"
    | "cobroke"
    /** Pengajuan sewa dari panel pemesanan halaman detail /Sewa. */
    | "form_inquiry";
  client_name?: string;
  client_phone?: string;
  client_email?: string;
  offer_amount?: number;
  discount_pct?: number;
  payment_method?: "cash" | "kpr";
  notes?: string;
}

export interface TrackLeadClickResult {
  ok: boolean;
  id_lead?: string;
  deduped?: boolean;
  error?: string;
  existing?: { id_lead: string; penawaran: number | null; created_at: string };
}

export async function trackLeadClick(
  input: TrackLeadClickInput,
): Promise<TrackLeadClickResult> {
  if (!input.id_property || !input.id_agent) {
    return { ok: false, error: "missing id_property / id_agent" };
  }

  try {
    const res = await fetch("/api/leads/click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_property: input.id_property.toString(),
        id_agent: input.id_agent,
        source: input.source,
        client_name: input.client_name,
        client_phone: input.client_phone,
        client_email: input.client_email,
        offer_amount: input.offer_amount,
        discount_pct: input.discount_pct,
        payment_method: input.payment_method,
        notes: input.notes,
        session_id: getSessionId(),
        referrer: typeof document !== "undefined" ? document.referrer : "",
      }),
      // jangan delay redirect kalau jaringan lambat
      keepalive: true,
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => null);
      return { ok: false, error: errBody?.error || `HTTP ${res.status}`, existing: errBody?.existing };
    }
    return (await res.json()) as TrackLeadClickResult;
  } catch (err) {
    console.error("trackLeadClick error:", err);
    return { ok: false, error: String(err) };
  }
}
