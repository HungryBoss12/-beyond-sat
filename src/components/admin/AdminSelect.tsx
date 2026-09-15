import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type AdminSelectOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type Props = {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
  /** Compact trigger for dense toolbars / row actions. */
  size?: "md" | "sm";
  /** brand = admin dark panels; light = white/cream surfaces. */
  tone?: "brand" | "light";
};

export function AdminSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  className,
  triggerClassName,
  disabled,
  size = "md",
  tone = "brand",
}: Props) {
  const brand = tone === "brand";
  const triggerBase = brand
    ? "w-full rounded-lg border border-brand-400/40 bg-brand-800 text-white shadow-none ring-offset-brand-900 transition-[border-color,box-shadow,background-color] duration-200 focus:ring-1 focus:ring-brand-300 data-[placeholder]:text-brand-200/60 hover:border-brand-300/60 disabled:opacity-50"
    : "w-full rounded-lg border border-brand-400/40 bg-white text-brand-900 shadow-none transition-[border-color,box-shadow] duration-200 focus:ring-1 focus:ring-brand-400 data-[placeholder]:text-brand-400 hover:border-brand-400 disabled:opacity-50";

  const contentCls = brand
    ? "z-[80] max-h-72 border-brand-400/40 bg-brand-800 text-white shadow-panel data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2"
    : "z-[80] max-h-72 border-brand-400/40 bg-white text-brand-900 shadow-lg data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2";

  const itemCls = brand
    ? "cursor-pointer rounded-md text-sm text-white outline-none transition-colors duration-150 focus:bg-brand-700 focus:text-white data-[highlighted]:bg-brand-700 data-[highlighted]:text-white data-[disabled]:opacity-40"
    : "cursor-pointer rounded-md text-sm text-brand-900 outline-none transition-colors duration-150 focus:bg-brand-100 focus:text-brand-900 data-[highlighted]:bg-brand-100 data-[highlighted]:text-brand-900 data-[disabled]:opacity-40";

  return (
    <div className={className}>
      {label ? (
        <div
          className={cn(
            "mb-1 text-sm font-semibold",
            brand ? "text-brand-100" : "text-brand-800",
          )}
        >
          {label}
        </div>
      ) : null}
      <Select value={value || undefined} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          className={cn(
            triggerBase,
            size === "sm" ? "mt-0 h-8 px-2.5 text-xs font-semibold" : "mt-0 h-10 px-3 text-sm",
            triggerClassName,
          )}
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={contentCls} position="popper">
          {options.map((opt) => (
            <SelectItem
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className={itemCls}
            >
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function AdminFieldLabel({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label className="block text-sm font-semibold text-brand-100">
      {label}
      {children}
      {hint ? <span className="mt-1 block text-xs font-normal text-brand-200/70">{hint}</span> : null}
    </label>
  );
}

export const adminInputCls = cn(
  "mt-1 w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200/60",
);
