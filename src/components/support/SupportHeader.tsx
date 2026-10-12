import { LifeBuoy } from "lucide-react";

export function SupportHeader() {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <h1 className="flex items-center gap-2 text-2xl font-black text-brand-900">
        <LifeBuoy className="h-7 w-7 text-brand-400" aria-hidden="true" />
        Support lessons
      </h1>
    </div>
  );
}
