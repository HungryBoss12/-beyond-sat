import { useEffect, useState } from "react";

export function SupportCountdown({ startsAt }: { startsAt: string | null }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startsAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [startsAt]);

  if (!startsAt) return null;
  const diff = new Date(startsAt).getTime() - now;
  if (Number.isNaN(diff)) return null;
  if (diff <= 0) return <p className="mt-1 text-xs font-bold">The lesson has started.</p>;
  const total = Math.floor(diff / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, "0");
  return (
    <p className="mt-1 text-xs font-bold">
      Starts in {hours}h {pad(minutes)}m {pad(seconds)}s
    </p>
  );
}
