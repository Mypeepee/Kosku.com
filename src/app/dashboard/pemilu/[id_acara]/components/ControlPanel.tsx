"use client";

import { Icon } from "@iconify/react";
import { motion } from "framer-motion";
import { Participant } from "../types/pemilu.types";

interface ControlPanelProps {
  currentUser: Participant | null;
  onJoinRoom: () => void;
  isActive: boolean;
}

export default function ControlPanel({
  currentUser,
  onJoinRoom,
  isActive,
}: ControlPanelProps) {
  const canJoin = !currentUser && isActive;
  const isParticipant = !!currentUser;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="sticky bottom-4 rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/95 to-slate-950/95 p-4 backdrop-blur-xl shadow-2xl"
    >
      <div className="flex items-center justify-between gap-4">
        {/* Status */}
        <div className="flex items-center gap-3">
          {isParticipant ? (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                <Icon icon="solar:check-circle-bold" className="text-xl text-emerald-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Kamu sudah join!</p>
                <p className="text-[10px] text-slate-400">
                  Status: <span className="text-emerald-400 font-bold">{currentUser.status_peserta}</span>
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-500/20 border border-slate-500/30">
                <Icon icon="solar:user-linear" className="text-xl text-slate-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-white">Belum bergabung</p>
                <p className="text-[10px] text-slate-400">Join untuk mulai memilih property</p>
              </div>
            </>
          )}
        </div>

        {/* Action Button */}
        {canJoin && (
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onJoinRoom}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-emerald-500/50 transition-all hover:shadow-xl hover:shadow-emerald-500/60"
          >
            <Icon icon="solar:login-3-bold" className="text-lg" />
            Join Sekarang
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}
