import { useId, useState } from "react";
import { maskUzsInput } from "@/lib/billing/money";
import { CLASS_CONTROL } from "@/components/classes/control";
import { cn } from "@/lib/utils";

/**
 * Digits-only UZS field with live thousands grouping. Pasted "e", ",", "." or "-"
 * is refused instead of being stripped, so 1.5e6 never turns into 156.
 */
export function MoneyInput({
  value,
  onChange,
  label,
  error,
  hint,
  autoFocus,
  placeholder = "",
  className,
}: {
  value: string;
  onChange: (masked: string) => void;
  label: string;
  error?: string | null;
  hint?: string;
  autoFocus?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const id = useId();
  const [pasteError, setPasteError] = useState<string | null>(null);
  const message = pasteError ?? error ?? null;
  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="text-xs font-bold text-white">
        {label}
      </label>
      <div className="relative mt-1">
        <input
          id={id}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          aria-invalid={message ? true : undefined}
          aria-describedby={message || hint ? `${id}-msg` : undefined}
          className={cn(
            CLASS_CONTROL,
            "pr-14 text-right font-bold tabular-nums",
            message && "border-brand-25 ring-2 ring-brand-25/60",
          )}
          value={value}
          onKeyDown={(event) => {
            if (["e", "E", ",", ".", "-", "+"].includes(event.key)) event.preventDefault();
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (/[^\d\s]/.test(text)) {
              event.preventDefault();
              setPasteError("Paste digits only — no commas, dots, minus or e");
            }
          }}
          onChange={(event) => {
            setPasteError(null);
            onChange(maskUzsInput(event.target.value));
          }}
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-xs font-bold text-brand-200">
          UZS
        </span>
      </div>
      {(message || hint) && (
        <p
          id={`${id}-msg`}
          role={message ? "alert" : undefined}
          className={cn("mt-1 text-xs", message ? "font-bold text-white" : "text-white")}
        >
          {message ?? hint}
        </p>
      )}
    </div>
  );
}
