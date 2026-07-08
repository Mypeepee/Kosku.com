"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

import AddProjectModal from "./AddProjectModal";
import type {
  CreateProjectFormValues,
  CreateProjectSubmitResponse,
  ListingOption,
  ModalTierTheme,
  ProjectFullResponse,
} from "./types";
import { buildCreateProjectPayload, buildFormFromProjectFull } from "./utils";

type Props = {
  open: boolean;
  idProject: string;
  theme: ModalTierTheme;
  createdById?: string;
  onClose: () => void;
  onSaved?: () => void | Promise<void>;
};

type Phase = "loading" | "ready" | "error";

function LoadingPortal({ onClose }: { onClose: () => void }) {
  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/80 p-5 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex items-center gap-3 rounded-3xl border border-white/10 bg-[#0a1220]/95 px-6 py-5 text-sm font-semibold text-slate-200 shadow-[0_30px_120px_rgba(0,0,0,0.45)]">
        <Loader2 className="h-5 w-5 animate-spin text-emerald-300" />
        Menyiapkan data project...
      </div>
    </div>,
    document.body
  );
}

export default function EditProjectModal({
  open,
  idProject,
  theme,
  createdById,
  onClose,
  onSaved,
}: Props) {
  const [phase, setPhase] = useState<Phase>("loading");
  const [initialValues, setInitialValues] =
    useState<CreateProjectFormValues | null>(null);
  const [listingSnapshot, setListingSnapshot] = useState<ListingOption | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !idProject) return;

    const controller = new AbortController();
    let active = true;

    setPhase("loading");
    setInitialValues(null);
    setListingSnapshot(null);

    (async () => {
      try {
        const response = await fetch(
          `/api/project/${encodeURIComponent(idProject)}/full`,
          { method: "GET", cache: "no-store", signal: controller.signal }
        );

        const result = (await response.json()) as ProjectFullResponse;

        if (!response.ok || !result.success || !result.data) {
          throw new Error(result.message || "Gagal mengambil data project.");
        }

        if (result.data.is_sold) {
          throw new Error(
            "Project ini sudah terjual dan tidak bisa diedit dari sini."
          );
        }

        if (!active) return;

        const { form, listing } = buildFormFromProjectFull(result.data);
        setInitialValues(form);
        setListingSnapshot(listing);
        setPhase("ready");
      } catch (error) {
        if ((error as Error).name === "AbortError") return;
        if (!active) return;

        setPhase("error");
        toast.error(
          error instanceof Error
            ? error.message
            : "Terjadi kesalahan saat mengambil data project."
        );
        onClose();
      }
    })();

    return () => {
      active = false;
      controller.abort();
    };
  }, [open, idProject, onClose]);

  async function handleUpdate(values: CreateProjectFormValues) {
    try {
      setSubmitting(true);

      const payload = buildCreateProjectPayload(values);

      const response = await fetch(
        `/api/project/${encodeURIComponent(idProject)}/update`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );

      const result = (await response.json()) as CreateProjectSubmitResponse;

      if (!response.ok || !result.success) {
        throw new Error(result.message || "Gagal menyimpan perubahan project.");
      }

      await onSaved?.();

      toast.success("Perubahan project berhasil disimpan!");
      onClose();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menyimpan perubahan project."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  if (phase !== "ready" || !initialValues) {
    return <LoadingPortal onClose={submitting ? () => {} : onClose} />;
  }

  return (
    <AddProjectModal
      open={open}
      mode="edit"
      onClose={onClose}
      onSubmit={handleUpdate}
      loading={submitting}
      theme={theme}
      createdById={createdById}
      initialValues={initialValues}
      initialListingSnapshot={listingSnapshot}
    />
  );
}
