import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300"></div>
        
        <input
          type={type}
          className={cn(
            // Base styles
            "relative flex h-11 w-full rounded-xl px-4 py-2 text-sm text-slate-100",
            
            // Background - Glassmorphism
            "bg-slate-900/50 backdrop-blur-sm",
            
            // Border - Emerald on focus
            "border-2 border-slate-800",
            "focus:border-emerald-500/50",
            
            // Focus ring
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
            
            // Placeholder
            "placeholder:text-slate-500",
            
            // Disabled state
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-900/30",
            
            // Transitions
            "transition-all duration-300",
            
            className
          )}
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
