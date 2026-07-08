import type {
    AcquisitionFinancials,
    BiayaBalikNamaBreakdown,
    CmaEntry,
    CreateProjectFormValues,
    CreateProjectPayload,
    FundingInvestorAllocation,
    ListingOption,
    ProjectCmaPayload,
    ProjectFullDetail,
    ProjectInvestorPayload,
    status_pembayaran_project_enum,
  } from "./types";
  
  function toSafeNumber(value?: number | string | null) {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) ? numeric : 0;
  }
  
  function toNonNegativeNumber(value?: number | string | null) {
    return Math.max(0, toSafeNumber(value));
  }
  
  export function formatCurrency(value?: number | null) {
    const numeric = Number(value ?? 0);
  
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      maximumFractionDigits: 0,
    }).format(Number.isFinite(numeric) ? numeric : 0);
  }
  
  export function formatNumberDots(value?: number | null): string {
    const numeric = Number(value ?? 0);
  
    if (!Number.isFinite(numeric) || numeric <= 0) return "";
  
    return new Intl.NumberFormat("id-ID", {
      maximumFractionDigits: 0,
    }).format(Math.round(numeric));
  }
  
  export function formatPercent(value?: number | null) {
    const numeric = Number(value ?? 0);
  
    if (!Number.isFinite(numeric)) return "-";
  
    return `${numeric >= 0 ? "+" : ""}${numeric.toFixed(2)}%`;
  }
  
  export function parseNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  export function parseFormattedNumber(value: string): number {
    if (!value) return 0;
  
    const digitsOnly = String(value).replace(/[^\d]/g, "");
    if (!digitsOnly) return 0;
  
    const parsed = Number(digitsOnly);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  
  export function numberInputValue(value?: number | null): string {
    const numeric = Number(value ?? 0);
    return Number.isFinite(numeric) && numeric > 0 ? String(numeric) : "";
  }
  
  function isLikelyGoogleDriveId(value: string) {
    return /^[A-Za-z0-9_-]{20,}$/.test(value);
  }
  
  function extractGoogleDriveId(rawUrl: string) {
    const patterns = [
      /[?&]id=([^&#]+)/i,
      /\/file\/d\/([^/]+)/i,
      /\/d\/([^/]+)/i,
      /\/thumbnail\?id=([^&#]+)/i,
      /\/uc\?(?:[^#]*&)?id=([^&#]+)/i,
    ];
  
    for (const pattern of patterns) {
      const match = rawUrl.match(pattern);
      if (match?.[1]) return match[1];
    }
  
    if (isLikelyGoogleDriveId(rawUrl)) {
      return rawUrl;
    }
  
    return null;
  }
  
  export function normalizeImageUrl(url?: string | null): string {
    if (!url) return "";
  
    const trimmed = String(url).trim();
    if (!trimmed) return "";
  
    const driveId = extractGoogleDriveId(trimmed);
    if (driveId) {
      return `https://drive.google.com/thumbnail?id=${driveId}&sz=w1200`;
    }
  
    if (
      trimmed.startsWith("data:") ||
      trimmed.startsWith("blob:") ||
      trimmed.startsWith("http://") ||
      trimmed.startsWith("https://")
    ) {
      return trimmed;
    }
  
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }
  
    if (trimmed.startsWith("/")) {
      return trimmed;
    }
  
    return trimmed;
  }
  
  export function formatCategoryLabel(value?: string | null) {
    if (!value) return "-";
  
    return String(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function formatTransactionLabel(value?: string | null) {
    if (!value) return "-";
  
    return String(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function formatLegalitasLabel(value?: string | null) {
    if (!value) return "-";
  
    return String(value)
      .toLowerCase()
      .replace(/_/g, " ")
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }
  
  export function createEmptyCmaEntry(seed: number | string): CmaEntry {
    return {
      id: `cma-${seed}-${Math.random().toString(36).slice(2, 7)}`,
      nama: "",
      luas_tanah: 0,
      harga: 0,
      catatan: "",
    };
  }
  
  export function createDefaultCmaEntries(count = 10): CmaEntry[] {
    return Array.from({ length: count }, (_, index) =>
      createEmptyCmaEntry(index + 1)
    );
  }
  
  export function createEmptyInvestorAllocation(
    seed: number | string
  ): FundingInvestorAllocation {
    return {
      id: `alloc-${seed}-${Math.random().toString(36).slice(2, 7)}`,
      investor_id: "",
      nominal: 0,
      investor_nama: "",
      investor_label: "",
      investor_avatar: "",
      status: "menunggu_pembayaran",
      catatan: "",
    };
  }
  
  export function createDefaultInvestorAllocations(
    count = 1
  ): FundingInvestorAllocation[] {
    return Array.from({ length: count }, (_, index) =>
      createEmptyInvestorAllocation(index + 1)
    );
  }
  
  export function getBiayaBalikNamaBreakdown(
    acquisitionBase: number
  ): BiayaBalikNamaBreakdown {
    const base = toNonNegativeNumber(acquisitionBase);
  
    const bea_lelang = base * 0.02; // 2%
    const bphtb = base * 0.05; // 5%
    const ppn_lelang = base * 0.011; // 1.1%
    const balik_nama = base * 0.001; // 0.1%
    const roya = 75000; // flat
  
    return {
      bea_lelang,
      bphtb,
      ppn_lelang,
      roya,
      balik_nama,
      total: bea_lelang + bphtb + ppn_lelang + balik_nama + roya,
    };
  }
  
  export function getProjectAcquisitionFinancials(
    form: Pick<
      CreateProjectFormValues,
      | "harga_pembelian"
      | "nilai_limit_lelang"
      | "spare_bidding"
      | "biaya_balik_nama"
      | "biaya_eksekusi"
      | "biaya_renov"
      | "target_pendanaan"
    >
  ): AcquisitionFinancials {
    const nilaiLimitLelang = toNonNegativeNumber(form.nilai_limit_lelang);
    const hargaPembelianInput = toNonNegativeNumber(form.harga_pembelian);
  
    const acquisition_base =
      nilaiLimitLelang > 0 ? nilaiLimitLelang : hargaPembelianInput;
  
    const acquisition_base_label =
      nilaiLimitLelang > 0 ? "Nilai Limit Lelang" : "Harga Dasar Property";
  
    const biaya_balik_nama_base =
      nilaiLimitLelang > 0 ? nilaiLimitLelang : acquisition_base;
  
    const biaya_balik_nama_base_label =
      nilaiLimitLelang > 0 ? "Nilai Limit Lelang" : acquisition_base_label;
  
    const spare_bidding = toNonNegativeNumber(form.spare_bidding);
    const biaya_eksekusi = toNonNegativeNumber(form.biaya_eksekusi);
    const biaya_renov = toNonNegativeNumber(form.biaya_renov);
    const target_pendanaan = toNonNegativeNumber(form.target_pendanaan);
  
    const biaya_balik_nama = getBiayaBalikNamaBreakdown(
      biaya_balik_nama_base
    );
  
    const harga_menang_lelang = acquisition_base + spare_bidding;
  
    const total_biaya_akuisisi =
      acquisition_base +
      spare_bidding +
      biaya_balik_nama.total +
      biaya_eksekusi +
      biaya_renov;
  
    const dana_cadangan = target_pendanaan - total_biaya_akuisisi;
  
    return {
      acquisition_base_label,
      acquisition_base,
      biaya_balik_nama_base_label,
      biaya_balik_nama_base,
      harga_menang_lelang,
      spare_bidding,
      biaya_balik_nama,
      biaya_eksekusi,
      biaya_renov,
      total_biaya_akuisisi,
      dana_cadangan,
      target_pendanaan,
    };
  }
  
  function roundSix(value: number) {
    return Number(value.toFixed(6));
  }
  
  export function getListingIdForProject(listing?: ListingOption | null): string {
    const value = listing?.id_property ?? listing?.id_listing ?? "";
    return value ? String(value) : "";
  }
  
  export function buildProjectCmaPayload(
    entries: CmaEntry[] = []
  ): ProjectCmaPayload[] {
    return entries
      .filter((entry) => {
        const hasNama = entry.nama.trim().length > 0;
        const hasLuas = Number(entry.luas_tanah || 0) > 0;
        const hasHarga = Number(entry.harga || 0) > 0;
        const hasCatatan = String(entry.catatan || "").trim().length > 0;
  
        return hasNama || hasLuas || hasHarga || hasCatatan;
      })
      .map((entry) => ({
        nama: entry.nama.trim(),
        luas_tanah: Number(entry.luas_tanah || 0),
        harga: Number(entry.harga || 0),
        catatan: entry.catatan?.trim() || null,
      }));
  }
  
  export function buildProjectInvestorPayload(
    form: Pick<
      CreateProjectFormValues,
      "target_pendanaan" | "invitedInvestorIds" | "investor_allocations"
    >
  ): ProjectInvestorPayload[] {
    const targetPendanaan = Number(form.target_pendanaan || 0);
    const defaultStatus: status_pembayaran_project_enum = "menunggu_pembayaran";
  
    const map = new Map<string, ProjectInvestorPayload>();
  
    for (const invitedId of form.invitedInvestorIds || []) {
      const id_agent = String(invitedId || "").trim();
      if (!id_agent) continue;
  
      map.set(id_agent, {
        id_agent,
        nominal_komitmen: 0,
        nominal_terbayar: 0,
        persentase_kepemilikan: null,
        status: defaultStatus,
        catatan: null,
      });
    }
  
    for (const allocation of form.investor_allocations || []) {
      const id_agent = String(allocation.investor_id || "").trim();
      if (!id_agent) continue;
  
      const nominal_komitmen = Math.max(0, Number(allocation.nominal || 0));
      const existing = map.get(id_agent);
  
      map.set(id_agent, {
        id_agent,
        nominal_komitmen:
          Number(existing?.nominal_komitmen || 0) + nominal_komitmen,
        nominal_terbayar: 0,
        persentase_kepemilikan: null,
        status: allocation.status || existing?.status || defaultStatus,
        catatan: allocation.catatan?.trim() || existing?.catatan || null,
      });
    }
  
    return Array.from(map.values()).map((item) => ({
      ...item,
      persentase_kepemilikan:
        targetPendanaan > 0 && item.nominal_komitmen > 0
          ? roundSix((item.nominal_komitmen / targetPendanaan) * 100)
          : null,
    }));
  }
  
  export function buildCreateProjectPayload(
    form: CreateProjectFormValues
  ): CreateProjectPayload {
    const financials = getProjectAcquisitionFinancials(form);
    const investor_allocations = buildProjectInvestorPayload(form);
    const cma_entries = buildProjectCmaPayload(form.cma_entries);
  
    const derivedTotalPendanaan =
      Number(form.total_pendanaan || 0) > 0
        ? Number(form.total_pendanaan || 0)
        : investor_allocations.reduce(
            (sum, item) => sum + Number(item.nominal_komitmen || 0),
            0
          );
  
    const estimasi_harga_jual = toNonNegativeNumber(form.estimasi_harga_jual);
    const estimasi_profit_bersih =
      estimasi_harga_jual - financials.total_biaya_akuisisi;
  
    return {
      id_listing: String(form.id_listing ?? "").trim(),
  
      nama_project: form.nama_project.trim(),
      alamat_property: form.alamat_property.trim(),
      provinsi: form.provinsi.trim(),
      kota: form.kota.trim(),
      kecamatan: form.kecamatan.trim(),
      kelurahan: form.kelurahan.trim(),
      gambar_thumbnail: normalizeImageUrl(form.gambar_thumbnail),
  
      tanggal_pembelian: form.tanggal_pembelian,
      harga_pembelian: Number(financials.total_biaya_akuisisi || 0),
      estimasi_harga_jual,
      estimasi_profit_bersih: Number(estimasi_profit_bersih || 0),
      target_pendanaan: Number(financials.target_pendanaan || 0),
      total_pendanaan: Number(derivedTotalPendanaan || 0),
  
      jenis_pendanaan: form.jenis_pendanaan,
      status: form.status,
  
      mulai_tanggal: form.mulai_tanggal,
      estimasi_selesai: form.estimasi_selesai,
      estimasi_bulan: Number(form.estimasi_bulan || 0),
      pendanaan_ditutup_pada: form.pendanaan_ditutup_pada,
  
      deskripsi_project: form.deskripsi_project.trim(),
      dibuat_oleh: String(form.dibuat_oleh || "").trim(),
  
      nilai_limit_lelang: Number(financials.acquisition_base || 0),
      spare_bidding: Number(financials.spare_bidding || 0),
      biaya_balik_nama: Number(financials.biaya_balik_nama.total || 0),
      biaya_eksekusi: Number(financials.biaya_eksekusi || 0),
      biaya_renov: Number(financials.biaya_renov || 0),
      total_biaya_akuisisi: Number(financials.total_biaya_akuisisi || 0),
      dana_cadangan: Number(financials.dana_cadangan || 0),
  
      investor_allocations,
      cma_entries,
    };
  }
  
  function mapCmaEntriesFromFull(
    entries: ProjectFullDetail["cma_entries"]
  ): CmaEntry[] {
    const mapped = entries.map((entry, index) => ({
      id: `cma-existing-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
      nama: entry.nama ?? "",
      luas_tanah: Number(entry.luas_tanah || 0),
      harga: Number(entry.harga || 0),
      catatan: entry.catatan ?? "",
    }));

    // Pad up to the same comfortable 10-row layout the create flow uses.
    if (mapped.length < 10) {
      return [...mapped, ...createDefaultCmaEntries(10 - mapped.length)];
    }

    return mapped;
  }

  function mapInvestorAllocationsFromFull(
    entries: ProjectFullDetail["investor_allocations"]
  ): FundingInvestorAllocation[] {
    const mapped = entries.map((entry, index) => ({
      id: `alloc-existing-${index + 1}-${Math.random().toString(36).slice(2, 7)}`,
      investor_id: entry.id_agent,
      nominal: Number(entry.nominal_komitmen || 0),
      investor_nama: entry.nama,
      investor_label: entry.label,
      investor_avatar: entry.foto_profil_url,
      status: entry.status,
      catatan: "",
    }));

    return mapped.length ? mapped : createDefaultInvestorAllocations(1);
  }

  /**
   * Rebuild the full wizard form (plus the source listing snapshot) from a
   * saved project so the edit flow starts exactly where the create flow left
   * off — same fields, same shape.
   */
  export function buildFormFromProjectFull(detail: ProjectFullDetail): {
    form: CreateProjectFormValues;
    listing: ListingOption | null;
  } {
    const investorAllocations = mapInvestorAllocationsFromFull(
      detail.investor_allocations
    );

    const invitedInvestorIds = Array.from(
      new Set(
        investorAllocations
          .map((item) => String(item.investor_id || "").trim())
          .filter(Boolean)
      )
    );

    const form: CreateProjectFormValues = {
      id_listing: detail.id_listing || null,

      nama_project: detail.nama_project ?? "",
      alamat_property: detail.alamat_property ?? "",
      provinsi: detail.provinsi ?? "",
      kota: detail.kota ?? "",
      kecamatan: detail.kecamatan ?? "",
      kelurahan: detail.kelurahan ?? "",
      gambar_thumbnail: detail.gambar_thumbnail ?? "",

      tanggal_pembelian: detail.tanggal_pembelian,
      harga_pembelian: Number(detail.harga_pembelian || 0),
      estimasi_harga_jual: Number(detail.estimasi_harga_jual || 0),
      estimasi_profit_bersih: Number(detail.estimasi_profit_bersih || 0),
      target_pendanaan: Number(detail.target_pendanaan || 0),
      total_pendanaan: Number(detail.total_pendanaan || 0),

      jenis_pendanaan: detail.jenis_pendanaan,
      status: detail.status,

      mulai_tanggal: detail.mulai_tanggal,
      estimasi_selesai: detail.estimasi_selesai,
      estimasi_bulan: Number(detail.estimasi_bulan || 0),
      pendanaan_ditutup_pada: detail.pendanaan_ditutup_pada,

      deskripsi_project: detail.deskripsi_project ?? "",
      dibuat_oleh: detail.dibuat_oleh ?? "",
      invitedInvestorIds,

      nilai_limit_lelang: Number(detail.nilai_limit_lelang || 0),
      spare_bidding: Number(detail.spare_bidding || 0),
      biaya_balik_nama: Number(detail.biaya_balik_nama || 0),
      biaya_eksekusi: Number(detail.biaya_eksekusi || 0),
      biaya_renov: Number(detail.biaya_renov || 0),
      total_biaya_akuisisi: Number(detail.total_biaya_akuisisi || 0),
      dana_cadangan: Number(detail.dana_cadangan || 0),

      cma_entries: mapCmaEntriesFromFull(detail.cma_entries),
      investor_allocations: investorAllocations,
    };

    return { form, listing: detail.listing };
  }

  export function getInitialForm(
    createdById?: string
  ): CreateProjectFormValues {
    return {
      id_listing: null,
  
      nama_project: "",
      alamat_property: "",
      provinsi: "",
      kota: "",
      kecamatan: "",
      kelurahan: "",
      gambar_thumbnail: "",
  
      tanggal_pembelian: null,
      harga_pembelian: 0,
      estimasi_harga_jual: 0,
      estimasi_profit_bersih: 0,
      target_pendanaan: 0,
      total_pendanaan: 0,
  
      jenis_pendanaan: "terbuka",
      status: "pendanaan_terbuka",
  
      mulai_tanggal: null,
      estimasi_selesai: null,
      estimasi_bulan: 0,
      pendanaan_ditutup_pada: null,
  
      deskripsi_project: "",
      dibuat_oleh: createdById || "",
      invitedInvestorIds: [],
  
      nilai_limit_lelang: 0,
      spare_bidding: 0,
      biaya_balik_nama: 0,
      biaya_eksekusi: 0,
      biaya_renov: 0,
      total_biaya_akuisisi: 0,
      dana_cadangan: 0,
  
      cma_entries: createDefaultCmaEntries(10),
      investor_allocations: createDefaultInvestorAllocations(1),
    };
  }