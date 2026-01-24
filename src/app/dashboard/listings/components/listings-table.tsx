// app/dashboard/listings/components/listings-table.tsx
"use client";

import { Icon } from "@iconify/react";

export type ListingStatus = "For Sale" | "For Rent" | "Pending" | "Draft" | "Archived";

export type Listing = {
  id: string;
  title: string;
  status: ListingStatus | string;
  type: string;
  city: string;
  area: string;
  price: string;
  beds: number;
  baths: number;
  size: string;
  updatedAt: string;
  views30d: number;
  inquiries: number;
};

export default function ListingsTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#050608]">
      {/* header atas tabel: info & bulk action (dummy) */}
      <div className="flex items-center justify-between gap-3 border-b border-white/5 px-4 py-3">
        <div className="flex items-center gap-2 text-[11px] text-slate-500">
          <span>
            Menampilkan{" "}
            <span className="text-emerald-400 font-semibold">
              {listings.length}
            </span>{" "}
            listing.
          </span>
          <span className="hidden sm:inline">
            Pilih beberapa untuk ubah status secara massal.
          </span>
        </div>
        <button className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#050608] px-3 py-1.5 text-[11px] text-slate-200 hover:bg-white/5">
          <Icon icon="solar:checklist-minimalistic-linear" className="text-xs" />
          Bulk actions
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="border-b border-white/5 bg-white/5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0"
                />
              </th>
              <th className="px-4 py-3">Listing</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Location</th>
              <th className="px-4 py-3">Specs</th>
              <th className="px-4 py-3">Activity</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((item) => (
              <tr
                key={item.id}
                className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
              >
                {/* checkbox */}
                <td className="px-4 py-3 align-top">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0"
                  />
                </td>

                {/* listing main */}
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-white line-clamp-1">
                      {item.title}
                    </span>
                    <span className="text-[11px] font-mono text-slate-500">
                      {item.id}
                    </span>
                  </div>
                </td>

                {/* status */}
                <td className="px-4 py-3 align-top">
                  <StatusPill status={item.status as ListingStatus} />
                </td>

                {/* type */}
                <td className="px-4 py-3 align-top text-xs text-slate-200">
                  {item.type}
                </td>

                {/* price */}
                <td className="px-4 py-3 align-top text-xs text-slate-100">
                  {item.price}
                </td>

                {/* location */}
                <td className="px-4 py-3 align-top text-xs text-slate-300">
                  <div className="flex flex-col gap-0.5">
                    <span>{item.city}</span>
                    <span className="text-[11px] text-slate-500">
                      {item.area}
                    </span>
                  </div>
                </td>

                {/* specs */}
                <td className="px-4 py-3 align-top text-xs text-slate-300">
                  <div className="flex flex-col gap-0.5">
                    <span>
                      {item.beds} bd • {item.baths} ba
                    </span>
                    <span className="text-[11px] text-slate-500">
                      {item.size}
                    </span>
                  </div>
                </td>

                {/* activity */}
                <td className="px-4 py-3 align-top text-[11px] text-slate-400">
                  <div className="flex flex-col gap-0.5">
                    <span className="flex items-center gap-1">
                      <Icon
                        icon="solar:chart-square-linear"
                        className="text-[13px] text-emerald-300"
                      />
                      {item.views30d} views / 30d
                    </span>
                    <span className="flex items-center gap-1">
                      <Icon
                        icon="solar:chat-round-dots-linear"
                        className="text-[13px] text-blue-300"
                      />
                      {item.inquiries} inquiries
                    </span>
                    <span className="text-[10px] text-slate-500">
                      Update: {item.updatedAt}
                    </span>
                  </div>
                </td>

                {/* actions */}
                <td className="px-4 py-3 align-top text-right">
                  <div className="inline-flex items-center gap-1">
                    <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/5">
                      <Icon
                        icon="solar:eye-linear"
                        className="text-sm text-slate-300"
                      />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 hover:bg-white/5">
                      <Icon
                        icon="solar:pen-new-square-linear"
                        className="text-sm text-slate-300"
                      />
                    </button>
                    <button className="flex h-8 w-8 items-center justify-center rounded-full border border-red-500/40 hover:bg-red-500/10">
                      <Icon
                        icon="solar:trash-bin-minimalistic-linear"
                        className="text-sm text-red-400"
                      />
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {listings.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  Belum ada property. Klik{" "}
                  <span className="text-emerald-400 font-medium">
                    “Tambah Property”
                  </span>{" "}
                  untuk membuat listing pertama.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: ListingStatus }) {
  let classes =
    "inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium ";
  let label = status;

  if (status === "For Sale") {
    classes += "bg-emerald-500/10 text-emerald-300";
  } else if (status === "For Rent") {
    classes += "bg-blue-500/10 text-blue-300";
  } else if (status === "Pending") {
    classes += "bg-amber-500/10 text-amber-300";
  } else if (status === "Draft") {
    classes += "bg-slate-500/10 text-slate-300";
  } else if (status === "Archived") {
    classes += "bg-slate-700/40 text-slate-400";
  }

  return (
    <span className={classes}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
