import * as React from "react";
import type { LucideIcon } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const VARIANT_CLASS = {
  brand: "btn-brand bg-brand-500 text-white hover:bg-brand-600",
  ghost: "tap bg-transparent text-brand-700 hover:bg-brand-25",
  outline: "tap border border-brand-200 bg-white text-brand-700 hover:bg-brand-25",
} as const;

export type IconButtonVariant = keyof typeof VARIANT_CLASS;

export type IconButtonProps = Omit<ButtonProps, "variant" | "size" | "children"> & {
  icon: LucideIcon;
  /** Accessible name and tooltip text. */
  label: string;
  variant?: IconButtonVariant;
  /** Set for toggles; renders aria-pressed. */
  pressed?: boolean;
  /** Text shown next to the icon (primary actions only). */
  text?: string;
  side?: "top" | "right" | "bottom" | "left";
};

/** Icon-first button: tooltip + aria-label, 40 px hit area, visible focus ring. */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  (
    { icon: Icon, label, variant = "ghost", pressed, text, side = "top", className, ...props },
    ref,
  ) => {
    const button = (
      <Button
        ref={ref}
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        className={cn(
          "h-10 min-w-10 rounded-full px-0 focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
          text ? "px-4" : "w-10",
          pressed && "bg-brand-100 text-brand-800",
          VARIANT_CLASS[variant],
          className,
        )}
        {...props}
      >
        <Icon aria-hidden="true" />
        {text ? <span>{text}</span> : null}
      </Button>
    );
    return (
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side={side} className="bg-brand-800 text-white">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  },
);
IconButton.displayName = "IconButton";
