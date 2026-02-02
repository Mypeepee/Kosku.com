"use client";

import { Icon } from "@iconify/react";
import { motion, AnimatePresence } from "framer-motion";
import { Notification } from "../types/pemilu.types";

interface SelectionsTimelineProps {
  notifications: Notification[];
}

export default function SelectionsTimeline({
  notifications,
}: SelectionsTimelineProps) {
  const getIconByType = (type: Notification["type"]) => {
    switch (type) {
      case "join":
        return "solar:login-3-bold";
      case "select":
        return "solar:check-circle-bold";
      case "complete":
        return "solar:star-bold";
      default:
        return "solar:info-circle-bold";
    }
  };

  const getColorByType = (type: Notification["type"]) => {
    switch (type) {
      case "join":
        return "blue";
      case "select":
        return "emerald";
      case "complete":
        return "purple";
      default:
        return "slate";
    }
  };

  return (
    <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl">
      {/* Header */}
      <div className="border-b border-white/10 bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/20 border border-orange-500/30">
            <Icon icon="solar:bell-bing-bold" className="text-lg text-orange-400" />
          </div>
          <h3 className="text-sm font-bold text-white">Live Activity</h3>
        </div>
      </div>

      {/* Timeline */}
      <div className="max-h-[600px] overflow-y-auto p-3 space-y-2 custom-scrollbar">
        <AnimatePresence mode="popLayout">
          {notifications.map((notif, idx) => {
            const color = getColorByType(notif.type);
            const icon = getIconByType(notif.type);

            return (
              <motion.div
                key={notif.id}
                initial={{ opacity: 0, x: 20, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -20, scale: 0.9 }}
                transition={{ delay: idx * 0.02 }}
                className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10 transition-all"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-${color}-500/20 border border-${color}-500/30`}
                  >
                    <Icon icon={icon} className={`text-base text-${color}-400`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white leading-relaxed">
                      {notif.message}
                    </p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-slate-500">
                        {new Date(notif.timestamp).toLocaleTimeString("id-ID")}
                      </span>
                      <span className="h-1 w-1 rounded-full bg-slate-600" />
                      <span className="text-[10px] font-semibold text-emerald-400">
                        {notif.agentName}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Glow effect */}
                <div className={`absolute inset-0 bg-gradient-to-r from-${color}-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none`} />
              </motion.div>
            );
          })}
        </AnimatePresence>

        {notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Icon icon="solar:bell-off-bold" className="text-5xl text-slate-600 mb-2" />
            <p className="text-xs text-slate-500">Belum ada aktivitas</p>
          </div>
        )}
      </div>
    </div>
  );
}
