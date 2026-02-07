import * as React from "react"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative group">
        {/* Glow effect on focus */}
        <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl opacity-0 group-focus-within:opacity-20 blur transition-opacity duration-300"></div>
        
        <select
          className={cn(
            // Base styles
            "relative flex h-11 w-full appearance-none rounded-xl px-4 py-2 pr-10 text-sm text-slate-100",
            
            // Background - Glassmorphism
            "bg-slate-900/50 backdrop-blur-sm",
            
            // Border - Emerald on focus
            "border-2 border-slate-800",
            "focus:border-emerald-500/50",
            
            // Focus ring
            "focus:outline-none focus:ring-2 focus:ring-emerald-500/20",
            
            // Disabled state
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-slate-900/30",
            
            // Transitions
            "transition-all duration-300",
            
            // Cursor
            "cursor-pointer",
            
            className
          )}
          ref={ref}
          {...props}
        >
          {children}
        </select>
        
        {/* Custom chevron icon with animation */}
        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-focus-within:text-emerald-400 pointer-events-none transition-colors duration-300" />
      </div>
    )
  }
)
Select.displayName = "Select"

export { Select }
