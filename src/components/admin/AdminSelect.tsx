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
};

type Props = {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
  options: AdminSelectOption[];
  placeholder?: string;
  className?: string;
};

const triggerCls =
  "mt-1 h-10 w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 text-sm text-white shadow-none ring-offset-brand-900 focus:ring-1 focus:ring-brand-300 data-[placeholder]:text-brand-200/60";

const contentCls =
  "border-brand-400/40 bg-brand-800 text-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2";

const itemCls =
  "cursor-pointer rounded-md text-white focus:bg-brand-700 focus:text-white data-[highlighted]:bg-brand-700 data-[highlighted]:text-white";

export function AdminSelect({
  label,
  value,
  onValueChange,
  options,
  placeholder = "Choose…",
  className,
}: Props) {
  return (
    <div className={className}>
      {label ? <div className="text-sm font-semibold text-brand-100">{label}</div> : null}
      <Select value={value || undefined} onValueChange={onValueChange}>
        <SelectTrigger className={triggerCls}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent className={contentCls}>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className={itemCls}>
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
      {hint ? (
        <span className="mt-1 block text-xs font-normal text-brand-200/70">{hint}</span>
      ) : null}
    </label>
  );
}

export const adminInputCls = cn(
  "mt-1 w-full rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-sm text-white placeholder:text-brand-200/60",
);
