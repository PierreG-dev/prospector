import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  trailingArrow?: boolean;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 ease-warm select-none disabled:opacity-50 disabled:cursor-not-allowed";

const variants: Record<Variant, string> = {
  primary:
    "bg-accent text-white hover:bg-accent/90 hover:scale-[1.02] shadow-warm-sm",
  secondary:
    "border-2 border-accent text-accent bg-transparent hover:bg-accent hover:text-white",
  ghost: "text-warmDark hover:bg-mid/60",
  danger:
    "bg-reject text-white hover:bg-reject/90 hover:scale-[1.02] shadow-warm-sm",
};

const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "primary",
    size = "md",
    icon,
    trailingArrow,
    className,
    children,
    ...rest
  },
  ref
) {
  return (
    <button
      ref={ref}
      className={cn(base, variants[variant], sizes[size], "group", className)}
      {...rest}
    >
      {icon}
      <span>{children}</span>
      {trailingArrow && (
        <ArrowRight
          className="h-4 w-4 transition-transform duration-200 ease-warm group-hover:translate-x-1"
          strokeWidth={2.25}
        />
      )}
    </button>
  );
});
