import * as React from "react"
import { cn } from "@/lib/utils"

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean
}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, required, children, ...props }, ref) => {
    return (
      <label
        ref={ref}
        className={cn(
          // Base styles
          "text-sm font-semibold mb-2 block",
          
          // Color - Gradient text effect
          "bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent",
          
          // Hover effect
          "group-hover:from-emerald-300 group-hover:to-teal-300 transition-all duration-300",
          
          className
        )}
        {...props}
      >
        <span className="flex items-center gap-1.5">
          {children}
          {required && (
            <span className="relative">
              <span className="text-red-500 font-bold">*</span>
              {/* Pulse effect for required fields */}
              <span className="absolute inset-0 text-red-500 animate-ping opacity-75">*</span>
            </span>
          )}
        </span>
      </label>
    )
  }
)
Label.displayName = "Label"

export { Label }
