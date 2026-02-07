import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'success' | 'danger'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          // Base styles
          "inline-flex items-center justify-center rounded-xl font-semibold transition-all duration-300",
          "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-black",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "relative overflow-hidden group",
          
          // Variant styles
          {
            // Default - Emerald Gradient with Shine Effect
            'bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:from-emerald-500 hover:to-teal-500 focus:ring-emerald-500 shadow-lg shadow-emerald-500/20 hover:shadow-emerald-500/40': 
              variant === 'default',
            
            // Secondary - Dark Slate
            'bg-gradient-to-r from-slate-800 to-slate-700 text-slate-100 hover:from-slate-700 hover:to-slate-600 focus:ring-slate-500 border border-slate-700': 
              variant === 'secondary',
            
            // Outline - Emerald Border with Glassmorphism
            'border-2 border-emerald-500/50 bg-transparent backdrop-blur-sm text-emerald-300 hover:bg-emerald-500/10 hover:border-emerald-400 focus:ring-emerald-500': 
              variant === 'outline',
            
            // Ghost - Minimal
            'bg-transparent text-slate-300 hover:bg-slate-800/50 hover:text-emerald-300': 
              variant === 'ghost',
            
            // Success - Green (Keep for positive actions)
            'bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-500 hover:to-emerald-500 focus:ring-green-500 shadow-lg shadow-green-500/20': 
              variant === 'success',
            
            // Danger - Red
            'bg-gradient-to-r from-red-600 to-rose-600 text-white hover:from-red-500 hover:to-rose-500 focus:ring-red-500 shadow-lg shadow-red-500/20': 
              variant === 'danger',
          },
          
          // Size styles
          {
            'h-11 px-6 text-sm': size === 'default',
            'h-9 px-4 text-xs': size === 'sm',
            'h-12 px-8 text-base': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      >
        {/* Shine effect on hover */}
        <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"></span>
        
        {/* Content */}
        <span className="relative z-10 flex items-center gap-2">
          {props.children}
        </span>
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button }
