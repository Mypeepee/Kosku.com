import React from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { AlertCircle, CheckCircle2, Info, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  success?: boolean;
  hint?: string;
  children: React.ReactNode;
  className?: string;
  description?: string; // ✅ Additional context
  icon?: React.ReactNode; // ✅ Custom icon for label
}

export function FormField({ 
  label, 
  required, 
  error, 
  success, 
  hint, 
  children,
  className,
  description,
  icon
}: FormFieldProps) {
  return (
    <motion.div 
      className={cn("space-y-2.5 group", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Label with optional icon */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon && (
            <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              {icon}
            </div>
          )}
          <Label required={required}>
            {label}
          </Label>
        </div>

        {/* Optional badge (e.g., "Beta", "New") */}
        {description && (
          <span className="text-[10px] px-2 py-0.5 bg-slate-800 text-slate-400 rounded-full border border-slate-700 uppercase tracking-wider font-semibold">
            Optional
          </span>
        )}
      </div>

      {/* Description text */}
      {description && (
        <p className="text-xs text-slate-400 leading-relaxed -mt-1">
          {description}
        </p>
      )}

      {/* Input Container with Status Indicators */}
      <div className="relative">
        {/* Glow effect on success/error */}
        <AnimatePresence>
          {success && !error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -inset-0.5 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl blur-md -z-10"
            />
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="absolute -inset-0.5 bg-gradient-to-r from-red-500/20 to-rose-500/20 rounded-xl blur-md -z-10"
            />
          )}
        </AnimatePresence>

        {/* Input wrapper */}
        <div className="relative">
          {children}
          
          {/* Success indicator with animation */}
          <AnimatePresence>
            {success && !error && (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 180 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10"
              >
                <div className="relative">
                  {/* Pulse effect */}
                  <motion.div
                    className="absolute inset-0 rounded-full bg-green-500/30"
                    animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <div className="relative w-6 h-6 rounded-full bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/50">
                    <CheckCircle2 className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Error Message - Enhanced */}
      <AnimatePresence mode="wait">
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: 'auto' }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/30 backdrop-blur-sm">
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0] }}
                transition={{ duration: 0.5 }}
              >
                <AlertCircle className="h-4 w-4 text-red-400 flex-shrink-0 mt-0.5" />
              </motion.div>
              <div className="flex-1">
                <p className="text-xs font-medium text-red-300 leading-relaxed">
                  {error}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint Message - Enhanced */}
      <AnimatePresence mode="wait">
        {hint && !error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2 p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 backdrop-blur-sm group/hint hover:bg-slate-800/70 hover:border-emerald-500/30 transition-all duration-300"
          >
            <div className="flex-shrink-0 mt-0.5">
              <div className="relative w-5 h-5">
                {/* Rotating ring on hover */}
                <motion.div
                  className="absolute inset-0 rounded-full border-2 border-emerald-500/30 border-t-emerald-500"
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
                />
                <Info className="absolute inset-0 m-auto h-3 w-3 text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-slate-400 group-hover/hint:text-slate-300 leading-relaxed transition-colors">
              {hint}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Character counter (if textarea/input) */}
      {React.isValidElement(children) && children.props.maxLength && (
        <div className="flex items-center justify-end gap-2 text-[10px]">
          <span className={cn(
            "font-medium transition-colors",
            (children.props.value?.length || 0) > children.props.maxLength * 0.9
              ? "text-amber-400"
              : "text-slate-500"
          )}>
            {children.props.value?.length || 0} / {children.props.maxLength}
          </span>
          {(children.props.value?.length || 0) === children.props.maxLength && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="text-amber-400"
            >
              ⚠️
            </motion.span>
          )}
        </div>
      )}
    </motion.div>
  );
}
