import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type AdminUserOption = {
  id: string;
  label: string;
};

type Props = {
  label?: string;
  users: AdminUserOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
};

export function AdminUserPicker({
  label = "Select students",
  users,
  selectedIds,
  onChange,
  placeholder = "Search and pick students…",
}: Props) {
  const [open, setOpen] = useState(false);

  const selectedLabels = useMemo(
    () =>
      selectedIds.map((id) => users.find((u) => u.id === id)?.label).filter(Boolean) as string[],
    [selectedIds, users],
  );

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  return (
    <div>
      {label ? <div className="text-sm font-semibold text-brand-100">{label}</div> : null}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "tap mt-1 flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-brand-400/40 bg-brand-800 px-3 py-2 text-left text-sm text-white transition-colors hover:border-brand-300/50",
              open && "border-brand-300 ring-1 ring-brand-300/40",
            )}
          >
            <span className="min-w-0 flex-1 truncate">
              {selectedIds.length === 0 ? (
                <span className="text-brand-200/60">{placeholder}</span>
              ) : (
                <span>
                  {selectedIds.length} selected
                  {selectedLabels.length ? ` · ${selectedLabels.slice(0, 2).join(", ")}` : ""}
                  {selectedLabels.length > 2 ? "…" : ""}
                </span>
              )}
            </span>
            <ChevronsUpDown
              className={cn(
                "h-4 w-4 shrink-0 text-brand-200 transition-transform duration-200",
                open && "rotate-180",
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-[var(--radix-popover-trigger-width)] border-brand-400/40 bg-brand-800 p-0 text-white data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
        >
          <Command className="bg-brand-800 text-white">
            <CommandInput
              placeholder="Search students…"
              className="text-white placeholder:text-brand-200/60"
            />
            <CommandList>
              <CommandEmpty className="py-6 text-center text-sm text-brand-200">
                No students found.
              </CommandEmpty>
              <CommandGroup>
                {users.map((user) => {
                  const picked = selectedIds.includes(user.id);
                  return (
                    <CommandItem
                      key={user.id}
                      value={user.label}
                      onSelect={() => toggle(user.id)}
                      className="cursor-pointer rounded-md text-white aria-selected:bg-brand-700 aria-selected:text-white"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4 shrink-0 text-brand-200 transition-opacity",
                          picked ? "opacity-100" : "opacity-0",
                        )}
                      />
                      {user.label}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedIds.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const name = users.find((u) => u.id === id)?.label ?? id.slice(0, 8);
            return (
              <span
                key={id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-700/80 px-2.5 py-1 text-xs font-semibold text-white"
              >
                {name}
                <button
                  type="button"
                  aria-label={`Remove ${name}`}
                  onClick={() => toggle(id)}
                  className="rounded-full p-0.5 hover:bg-brand-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
