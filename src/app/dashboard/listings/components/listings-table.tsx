// app/dashboard/listings/components/listings-table.tsx
"use client";

import Link from "next/link";
import { Icon } from "@iconify/react";

export type ListingStatus = "For Sale" | "For Rent" | "Pending" | "Draft" | "Archived";

export type Listing = {
  id: string;
  title: string;
  status: ListingStatus | string;
  category: string;
  transactionType: string;
  city: string;
  area: string;
  address: string;
  price: string;
  thumbnailUrl?: string;
};

export default function ListingsTable({ listings }: { listings: Listing[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#050608]">
      {/* HEADER ATAS: info, search, bulk delete */}
      <div className="flex flex-col gap-3 border-b border-white/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-[11px] text-slate-400">
          <span>
            Menampilkan{" "}
            <span className="font-semibold text-emerald-400">
              {listings.length}
            </span>{" "}
            listing.
          </span>
        </div>

        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <Icon
              icon="solar:magnifer-linear"
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500"
            />
            <input
              type="text"
              placeholder="Cari ID, alamat, kota..."
              className="h-8 w-full rounded-xl border border-white/10 bg-[#050608] pl-8 pr-3 text-[11px] text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-400/60"
            />
          </div>

          {/* Bulk delete */}
          <button className="inline-flex items-center justify-center gap-1 rounded-xl border border-red-500/40 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-300 hover:bg-red-500/20">
            <Icon
              icon="solar:trash-bin-minimalistic-linear"
              className="text-xs"
            />
            Hapus terpilih
          </button>
        </div>
      </div>

      {/* TABEL */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs text-slate-300">
          <thead className="border-b border-white/5 bg-white/5 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <tr>
              <th className="w-8 px-4 py-3">
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0"
                />
              </th>
              <th className="w-10 px-2 py-3">Aksi</th>
              <th className="w-32 px-4 py-3">ID Listing</th>
              <th className="w-16 px-2 py-3">Foto</th>
              <th className="px-4 py-3">Kategori</th>
              <th className="px-4 py-3">Transaksi</th>
              <th className="px-4 py-3">Alamat</th>
              <th className="px-4 py-3">Harga</th>
              <th className="px-4 py-3 text-right">Edit</th>
            </tr>
          </thead>
          <tbody>
            {listings.map((item) => (
              <tr
                key={item.id}
                className="border-b border-white/5 last:border-0 transition-colors hover:bg-white/5"
              >
                {/* checkbox */}
                <td className="px-4 py-3 align-top">
                  <input
                    type="checkbox"
                    className="h-3.5 w-3.5 rounded border-white/20 bg-transparent text-emerald-400 focus:ring-0"
                  />
                </td>

                {/* tombol utama (view/detail) */}
                <td className="px-2 py-3 align-top">
                  <button className="flex h-8 w-8 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/20">
                    <Icon icon="solar:eye-linear" className="text-sm" />
                  </button>
                </td>

                {/* ID listing */}
                <td className="px-4 py-3 align-top">
                  <span className="font-mono text-[11px] text-slate-200">
                    {item.id}
                  </span>
                </td>

                {/* thumbnail */}
                <td className="px-2 py-3 align-top">
                  {item.thumbnailUrl ? (
                    <div className="h-10 w-14 overflow-hidden rounded-md border border-white/10 bg-black/40">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={item.thumbnailUrl}
                        alt={item.title}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="flex h-10 w-14 items-center justify-center rounded-md border border-dashed border-slate-600 bg-black/40 text-[10px] text-slate-500">
                      No img
                    </div>
                  )}
                </td>

                {/* kategori */}
                <td className="px-4 py-3 align-top text-xs text-slate-200">
                  {item.category}
                </td>

                {/* jenis transaksi */}
                <td className="px-4 py-3 align-top text-xs text-slate-200">
                  {item.transactionType}
                </td>

                {/* alamat */}
                <td className="px-4 py-3 align-top text-xs text-slate-300">
                  <div className="flex flex-col gap-0.5">
                    <span className="line-clamp-1">{item.address}</span>
                    <span className="text-[11px] text-slate-500">
                      {item.area && `${item.area}, `}
                      {item.city}
                    </span>
                  </div>
                </td>

                {/* harga */}
                <td className="px-4 py-3 align-top text-xs text-emerald-200">
                  {item.price}
                </td>

                {/* tombol edit */}
                <td className="px-4 py-3 align-top text-right">
                  <button className="inline-flex h-8 items-center justify-center gap-1 rounded-full border border-white/15 bg-white/5 px-3 text-[11px] text-slate-100 hover:bg-white/10">
                    <Icon
                      icon="solar:pen-new-square-linear"
                      className="text-xs"
                    />
                    Edit
                  </button>
                </td>
              </tr>
            ))}

            {listings.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-4 py-10 text-center text-xs text-slate-500"
                >
                  Belum ada property.{" "}
                  <Link
                    href="/dashboard/listings/new" // ganti sesuai route form tambah property
                    className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 hover:bg-emerald-500/20"
                  >
                    <Icon
                      icon="solar:add-circle-linear"
                      className="text-xs"
                    />
                    Tambah Property
                  </Link>{" "}
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
