// src/lib/poster/downloadPoster.ts
// Helper klien: POST payload ke endpoint poster, terima JPEG, lalu unduh/bagikan.
// Mobile → native share sheet (Simpan Gambar → Galeri). Desktop → unduh file.

export function safeFileName(s: string): string {
  return (
    (s || "poster")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "poster"
  );
}

export async function downloadPosterImage(
  endpoint: string,
  payload: unknown,
  baseName: string,
  onStateChange?: (loading: boolean) => void,
): Promise<void> {
  onStateChange?.(true);
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const blob = await res.blob();
    const fileName = `${baseName}.jpg`;
    const file = new File([blob], fileName, { type: "image/jpeg" });

    const isMobile = /Android|iPhone|iPad|iPod/i.test(
      typeof navigator !== "undefined" ? navigator.userAgent : "",
    );
    if (
      isMobile &&
      typeof navigator.share === "function" &&
      navigator.canShare?.({ files: [file] })
    ) {
      await navigator.share({ files: [file], title: "Poster Properti" });
      return;
    }

    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(objectUrl);
  } catch (err: any) {
    if (err?.name !== "AbortError") {
      alert("Gagal membuat poster. Silakan coba lagi.");
    }
  } finally {
    onStateChange?.(false);
  }
}
