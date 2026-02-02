"use client";

import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { Property, Selection, Participant } from "../types/pemilu.types";

interface PropertyGridProps {
  properties: Property[];
  selections: Selection[];
  currentUser: Participant | null;
  onSelectProperty: (propertyId: string) => void;
  isActive: boolean;
}

export default function PropertyGrid({
  properties,
  selections,
  currentUser,
  onSelectProperty,
  isActive,
}: PropertyGridProps) {
  const isPropertySelected = (propertyId: string) => {
    return selections.some((s) => s.id_unit === parseInt(propertyId));
  };

  const getPropertyOwner = (propertyId: string) => {
    return selections.find((s) => s.id_unit === parseInt(propertyId));
  };

  const canUserSelect = (propertyId: string) => {
    return (
      isActive &&
      currentUser?.status_peserta === "AKTIF" &&
      !isPropertySelected(propertyId)
    );
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 border border-blue-500/30">
            <Icon icon="solar:buildings-3-bold" className="text-lg text-blue-400" />
          </div>
          <h3 className="text-sm font-bold text-white">Property Tersedia</h3>
        </div>
      </div>

      {/* Grid */}
      <div className="p-4 max-h-[600px] overflow-y-auto custom-scrollbar">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {properties.map((property, idx) => {
              const isSelected = isPropertySelected(property.id_property);
              const owner = getPropertyOwner(property.id_property);
              const canSelect = canUserSelect(property.id_property);

              return (
                <motion.div
                  key={property.id_property}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.02 }}
                  className={`
                    group relative overflow-hidden rounded-2xl border
                    transition-all duration-300
                    ${
                      isSelected
                        ? "border-red-500/50 bg-red-500/10"
                        : "border-white/10 bg-white/5 hover:border-emerald-500/50 hover:bg-emerald-500/5"
                    }
                  `}
                >
                  {/* Image */}
                  <div className="relative h-32 overflow-hidden">
                    {property.foto_url ? (
                      <img
                        src={property.foto_url}
                        alt={property.nama_property}
                        className="h-full w-full object-cover transition-transform group-hover:scale-110"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 to-slate-900">
                        <Icon icon="solar:home-2-bold" className="text-5xl text-slate-600" />
                      </div>
                    )}
                    
                    {/* Status badge */}
                    <div className="absolute top-2 right-2">
                      {isSelected ? (
                        <span className="flex items-center gap-1 rounded-full bg-red-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                          <Icon icon="solar:check-circle-bold" />
                          Dipilih
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg">
                          Tersedia
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-3">
                    <h4 className="text-sm font-bold text-white line-clamp-1 mb-1">
                      {property.nama_property}
                    </h4>
                    
                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-2">
                      <Icon icon="solar:map-point-bold" className="text-xs" />
                      <span className="truncate">{property.lokasi}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-slate-500">Harga</p>
                        <p className="text-sm font-bold text-emerald-400">
                          {new Intl.NumberFormat("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            minimumFractionDigits: 0,
                          }).format(property.harga)}
                        </p>
                      </div>

                      {/* Action button */}
                      {isSelected && owner ? (
                        <div className="text-right">
                          <p className="text-[9px] text-slate-500">Dipilih oleh</p>
                          <p className="text-xs font-semibold text-white truncate max-w-[100px]">
                            {owner.agent?.pengguna.nama_lengkap || owner.id_agent}
                          </p>
                        </div>
                      ) : (
                        <button
                          onClick={() => onSelectProperty(property.id_property)}
                          disabled={!canSelect}
                          className={`
                            rounded-lg px-3 py-1.5 text-xs font-bold
                            transition-all duration-200
                            ${
                              canSelect
                                ? "bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-lg shadow-emerald-500/50 hover:scale-105 active:scale-95"
                                : "bg-slate-500/20 text-slate-500 cursor-not-allowed"
                            }
                          `}
                        >
                          {canSelect ? "Pilih" : "Locked"}
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Hover shine */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/5 to-white/0 opacity-0 transition-opacity group-hover:opacity-100 pointer-events-none" />
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
