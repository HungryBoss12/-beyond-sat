export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wider text-brand-100">
        {label}
      </span>
      {children}
    </label>
  );
}
