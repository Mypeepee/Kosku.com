'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Step {
  id: number;
  label: string;
  icon: string;
}

interface ProgressIndicatorProps {
  currentStep: number;
  steps: Step[];
}

export function ProgressIndicator({ currentStep, steps }: ProgressIndicatorProps) {
  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className="w-full mb-10 px-2">
      {/* Step Counter - Modern Stats */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1">
            <motion.span 
              key={currentStep}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-3xl font-bold bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent"
            >
              {currentStep}
            </motion.span>
            <span className="text-slate-500 text-sm font-medium">/ {steps.length}</span>
          </div>
          <div className="h-8 w-px bg-slate-800"></div>
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wider">Step</p>
            <p className="text-sm font-semibold text-slate-300">{steps[currentStep - 1]?.label}</p>
          </div>
        </div>

        {/* Progress Percentage */}
        <motion.div 
          className="px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-500/10 to-teal-500/10 border border-emerald-500/30"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
        >
          <span className="text-xs font-bold text-emerald-400">
            {Math.round(progressPercentage)}% Complete
          </span>
        </motion.div>
      </div>

      {/* Progress Bar Container */}
      <div className="relative">
        {/* Background Line - Multi-layer for depth */}
        <div className="absolute top-5 left-0 right-0 h-1 -z-10">
          {/* Base layer */}
          <div className="absolute inset-0 bg-slate-800/50 rounded-full"></div>
          {/* Inner shadow */}
          <div className="absolute inset-0 bg-gradient-to-r from-slate-900/50 via-slate-800/30 to-slate-900/50 rounded-full"></div>
        </div>

        {/* Animated Progress Line */}
        <div className="absolute top-5 left-0 right-0 h-1 -z-10 overflow-hidden rounded-full">
          <motion.div
            className="h-full relative"
            initial={{ width: '0%' }}
            animate={{ width: `${progressPercentage}%` }}
            transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Main gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-emerald-400 to-teal-500 rounded-full"></div>
            
            {/* Glow effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-400 to-teal-400 blur-sm rounded-full opacity-70"></div>
            
            {/* Shimmer animation */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent rounded-full"
              animate={{ x: ['-100%', '200%'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
            />
          </motion.div>
        </div>

        {/* Steps */}
        <div className="flex items-center justify-between relative">
          {steps.map((step, index) => {
            const isCompleted = currentStep > step.id;
            const isCurrent = currentStep === step.id;
            const isUpcoming = currentStep < step.id;
            
            return (
              <div key={step.id} className="flex flex-col items-center gap-3 relative group">
                {/* Step Circle Container */}
                <motion.div
                  className="relative"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1, type: 'spring', stiffness: 200 }}
                >
                  {/* Outer glow ring (current step only) */}
                  {isCurrent && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      animate={{
                        boxShadow: [
                          '0 0 0 0px rgba(16, 185, 129, 0.4)',
                          '0 0 0 8px rgba(16, 185, 129, 0)',
                        ],
                      }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                  )}

                  {/* Main Circle */}
                  <motion.div
                    className={cn(
                      "w-11 h-11 rounded-full flex items-center justify-center text-lg font-bold relative overflow-hidden",
                      "transition-all duration-500 backdrop-blur-sm",
                      {
                        // Current - Emerald gradient with glow
                        'bg-gradient-to-br from-emerald-500 via-emerald-400 to-teal-500 text-white shadow-lg shadow-emerald-500/50 border-2 border-emerald-300/50': 
                          isCurrent,
                        
                        // Completed - Success green
                        'bg-gradient-to-br from-green-500 to-emerald-500 text-white shadow-md shadow-green-500/30': 
                          isCompleted,
                        
                        // Upcoming - Glassmorphism
                        'bg-slate-900/50 text-slate-500 border-2 border-slate-700 hover:border-slate-600': 
                          isUpcoming,
                      }
                    )}
                    whileHover={{ scale: 1.1 }}
                    animate={isCurrent ? { 
                      scale: [1, 1.05, 1],
                    } : {}}
                    transition={{ 
                      scale: { duration: 2, repeat: Infinity },
                    }}
                  >
                    {/* Content */}
                    <div className="relative z-10">
                      {isCompleted ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -180 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: 'spring', stiffness: 200 }}
                        >
                          <Check className="h-5 w-5" strokeWidth={3} />
                        </motion.div>
                      ) : (
                        <motion.span
                          animate={isCurrent ? { 
                            scale: [1, 1.2, 1],
                          } : {}}
                          transition={{ duration: 2, repeat: Infinity }}
                        >
                          {step.icon}
                        </motion.span>
                      )}
                    </div>

                    {/* Shimmer effect for current */}
                    {isCurrent && (
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                        animate={{ x: ['-100%', '200%'] }}
                        transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                      />
                    )}
                  </motion.div>

                  {/* Number badge for upcoming steps */}
                  {isUpcoming && (
                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-slate-800 border border-slate-700 rounded-full flex items-center justify-center">
                      <span className="text-[10px] font-bold text-slate-500">{step.id}</span>
                    </div>
                  )}
                </motion.div>
                
                {/* Step Label */}
                <motion.div
                  className="flex flex-col items-center gap-0.5"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 + 0.2 }}
                >
                  <span className={cn(
                    "text-xs font-semibold text-center transition-all duration-300 whitespace-nowrap",
                    {
                      'text-emerald-400 scale-105': isCurrent,
                      'text-green-400': isCompleted,
                      'text-slate-500 group-hover:text-slate-400': isUpcoming,
                    }
                  )}>
                    {step.label}
                  </span>

                  {/* Status indicator dot */}
                  <div className={cn(
                    "w-1 h-1 rounded-full transition-all duration-300",
                    {
                      'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.8)]': isCurrent,
                      'bg-green-400': isCompleted,
                      'bg-slate-700': isUpcoming,
                    }
                  )} />
                </motion.div>

                {/* Connection line preview on hover (upcoming) */}
                {isUpcoming && index > 0 && (
                  <div className="absolute -left-full top-5 w-full h-px bg-slate-700 opacity-0 group-hover:opacity-50 transition-opacity -z-20" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Step Description (Optional - shows current step info) */}
      <motion.div
        key={currentStep}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 p-4 rounded-xl bg-gradient-to-br from-slate-900/40 to-slate-800/20 backdrop-blur-sm border border-slate-800"
      >
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
            <span className="text-lg">{steps[currentStep - 1]?.icon}</span>
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-slate-200 mb-1">
              {steps[currentStep - 1]?.label}
            </h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              {getStepDescription(currentStep)}
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

// Helper function for step descriptions
function getStepDescription(step: number): string {
  const descriptions: Record<number, string> = {
    1: 'Masukkan informasi dasar properti seperti judul, jenis transaksi, dan kategori.',
    2: 'Tentukan lokasi properti dengan detail alamat lengkap.',
    3: 'Atur harga jual, harga promo, dan informasi pembayaran lainnya.',
    4: 'Lengkapi spesifikasi teknis properti seperti luas tanah, kamar, dan fasilitas.',
    5: 'Upload foto-foto properti untuk menarik perhatian pembeli.',
  };
  return descriptions[step] || 'Lengkapi informasi pada step ini.';
}
