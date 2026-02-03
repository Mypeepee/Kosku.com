// app/dashboard/hrm/components/shared/Avatar.tsx
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: "sm" | "md" | "lg";
  status?: "online" | "offline";
}

export function Avatar({ src, name, size = "md", status }: AvatarProps) {
  const [imgError, setImgError] = useState(false);

  const sizeClasses = {
    sm: "h-8 w-8 text-sm",
    md: "h-10 w-10 text-base",
    lg: "h-14 w-14 text-xl",
  };

  // ✅ Logic sama persis dengan Blade lama
  const buildAgentImage = (fileIdOrUrl?: string | null) => {
    const DEFAULT = "/images/default-profile.png";

    if (!fileIdOrUrl || fileIdOrUrl.trim() === "") {
      return {
        thumb: DEFAULT,
        full: DEFAULT,
      };
    }

    const raw = fileIdOrUrl.trim();

    // Kalau sudah URL lengkap (http/https)
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      try {
        const url = new URL(raw);
        // Ekstrak id dari query parameter (?id=...)
        const idFromQuery = url.searchParams.get("id");
        if (idFromQuery) {
          return {
            thumb: `https://drive.google.com/thumbnail?id=${idFromQuery}&sz=w64`,
            full: `https://drive.google.com/uc?export=view&id=${idFromQuery}`,
          };
        }

        // Ekstrak id dari path (/d/{id}/)
        const match = raw.match(/\/d\/([^/]+)/);
        if (match?.[1]) {
          const id = match[1];
          return {
            thumb: `https://drive.google.com/thumbnail?id=${id}&sz=w64`,
            full: `https://drive.google.com/uc?export=view&id=${id}`,
          };
        }

        // Bukan Google Drive → pakai apa adanya
        return {
          thumb: raw,
          full: raw,
        };
      } catch {
        return {
          thumb: DEFAULT,
          full: DEFAULT,
        };
      }
    }

    // Kalau hanya fileId (seperti di Blade: $property->agent_picture)
    const fileId = raw;
    return {
      thumb: `https://drive.google.com/thumbnail?id=${fileId}&sz=w64`,
      full: `https://drive.google.com/uc?export=view&id=${fileId}`,
    };
  };

  const { thumb, full } = buildAgentImage(src);

  return (
    <div className="relative inline-block">
      <div
        className={`${sizeClasses[size]} rounded-full bg-slate-800 border-2 border-white/10 flex items-center justify-center overflow-hidden`}
      >
        {thumb && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumb}
            alt={name}
            className="h-full w-full object-cover"
            onError={(e) => {
              // Fallback pertama: coba URL full
              if (thumb !== full) {
                (e.target as HTMLImageElement).src = full;
              } else {
                // Fallback terakhir: tampilkan icon
                setImgError(true);
              }
            }}
          />
        ) : (
          <Icon icon="solar:user-circle-bold" className="text-slate-500" />
        )}
      </div>
      {status && (
        <span
          className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#05060A] ${
            status === "online" ? "bg-emerald-400" : "bg-slate-500"
          }`}
        />
      )}
    </div>
  );
}
