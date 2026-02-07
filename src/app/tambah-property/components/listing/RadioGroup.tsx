'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface RadioOption {
  value: string;
  label: string;
  icon?: string;
  description?: string;
}

interface RadioGroupProps {
  options: RadioOption[];
  value: string;
  onChange: (value: string) => void;
  name: string;
  className?: string;
  compact?: boolean; // ✅ Compact mode for smaller cards
  columns?: 1 | 2 | 3 | 4; // ✅ Flexible grid columns
}

export function RadioGroup({ 
  options, 
  value, 
  onChange, 
  name, 
  className,
  compact = false,
  columns = 2 
}: RadioGroupProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={cn("grid gap-4", gridCols[columns], className)}>
      {options.map((option) => {
        const isSelected = value === option.value;
        
        return (
          <motion.label
            key={option.value}
            className={cn(
              // Base styles
              "relative flex items-center cursor-pointer transition-all duration-300 overflow-hidden group",
              "rounded-xl border-2",
              
              // Compact mode padding
              compact ? "gap-3 p-3" : "gap-4 p-4",
              
              // Border & Background
              {
                // Selected - Emerald glow
                'border-emerald-500/60 bg-gradient-to-br from-emerald-500/10 via-teal-500/5 to-transparent shadow-lg shadow-emerald-500/10': isSelected,
                
                // Unselected - Glassmorphism
                'border-slate-800 bg-slate-900/30 backdrop-blur-sm hover:border-emerald-500/30 hover:bg-slate-900/50': !isSelected,
              }
            )}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={isSelected}
              onChange={() => onChange(option.value)}
              className="sr-only"
            />
            
            {/* Outer glow effect */}
            {isSelected && (
              <motion.div
                className="absolute -inset-1 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-xl blur-lg -z-10"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              />
            )}
            
            {/* Radio Circle */}
            <div className="relative shrink-0 z-10">
              <div className={cn(
                "rounded-full border-2 flex items-center justify-center transition-all duration-300",
                compact ? "w-5 h-5" : "w-6 h-6",
                {
                  'border-emerald-500 shadow-[0_0_12px_rgba(16,185,129,0.5)]': isSelected,
                  'border-slate-600 group-hover:border-emerald-500/50': !isSelected,
                }
              )}>
                {isSelected && (
                  <motion.div
                    className={cn(
                      "rounded-full bg-gradient-to-br from-emerald-400 to-teal-500",
                      compact ? "w-2.5 h-2.5" : "w-3 h-3"
                    )}
                    layoutId={`radio-${name}`}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  />
                )}
              </div>
            </div>
            
            {/* Content */}
            <div className="flex items-center gap-3 flex-1 relative z-10 min-w-0">
              {option.icon && (
                <motion.span 
                  className={cn("shrink-0", compact ? "text-xl" : "text-3xl")}
                  animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {option.icon}
                </motion.span>
              )}
              
              <div className="flex-1 min-w-0">
                <span className={cn(
                  "font-semibold block transition-colors duration-300 truncate",
                  compact ? "text-xs" : "text-sm",
                  {
                    'text-slate-100': isSelected,
                    'text-slate-300 group-hover:text-emerald-300': !isSelected,
                  }
                )}>
                  {option.label}
                </span>
                
                {option.description && !compact && (
                  <span className={cn(
                    "text-xs mt-0.5 block line-clamp-1 transition-colors duration-300",
                    {
                      'text-slate-400': isSelected,
                      'text-slate-500 group-hover:text-slate-400': !isSelected,
                    }
                  )}>
                    {option.description}
                  </span>
                )}
              </div>
            </div>
            
            {/* Check icon on selected */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                className={cn(
                  "absolute bg-gradient-to-br from-emerald-500 to-teal-500 rounded-full flex items-center justify-center z-10",
                  compact ? "top-2 right-2 w-4 h-4" : "top-3 right-3 w-5 h-5"
                )}
              >
                <svg className={cn("text-white", compact ? "w-2.5 h-2.5" : "w-3 h-3")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </motion.div>
            )}
            
            {/* Shimmer effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 pointer-events-none" />
          </motion.label>
        );
      })}
    </div>
  );
}
