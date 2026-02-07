'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, CloudOff, Loader2, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface AutoSaveIndicatorProps {
  status: SaveStatus;
}

export function AutoSaveIndicator({ status }: AutoSaveIndicatorProps) {
  const config = {
    idle: { icon: Cloud, text: '', color: 'text-slate-500', show: false },
    saving: { icon: Loader2, text: 'Menyimpan...', color: 'text-blue-400', show: true },
    saved: { icon: Check, text: 'Tersimpan', color: 'text-green-400', show: true },
    error: { icon: CloudOff, text: 'Gagal menyimpan', color: 'text-red-400', show: true },
  }[status];

  const Icon = config.icon;

  return (
    <AnimatePresence>
      {config.show && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className={cn(
            "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2 rounded-lg",
            "bg-slate-800 border border-slate-700 shadow-xl",
            config.color
          )}
        >
          <Icon className={cn("h-4 w-4", status === 'saving' && "animate-spin")} />
          <span className="text-sm font-medium">{config.text}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
