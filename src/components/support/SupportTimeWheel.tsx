import { useEffect, useMemo, useRef } from "react";
import type { CenterHours } from "@/lib/support/api";

const ITEM = 40;

function minutesOf(value: string): number {
  const [hour, minute] = value.split(":");
  return Number(hour) * 60 + Number(minute);
}

function label(total: number): string {
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** Starts that begin at or after opening and finish at or before closing. */
export function lessonStartTimes(hours: CenterHours | null): string[] {
  if (!hours) return [];
  const open = minutesOf(hours.opens_at);
  const close = minutesOf(hours.closes_at);
  const last = close - 60;
  if (!Number.isFinite(open) || !Number.isFinite(close) || last < open) return [];
  const times: string[] = [];
  for (let cursor = open; cursor <= last; cursor += 5) times.push(label(cursor));
  return times;
}

function clampIndex(index: number, length: number): number {
  return Math.min(length - 1, Math.max(0, index));
}

function WheelColumn({
  values,
  value,
  onChange,
  ariaLabel,
}: {
  values: string[];
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; top: number; target: number; frame: number } | null>(null);
  const settling = useRef(false);

  useEffect(() => {
    const el = scroller.current;
    if (!el || values.length === 0 || drag.current || settling.current) return;
    const index = Math.max(0, values.indexOf(value));
    const top = index * ITEM;
    if (Math.abs(el.scrollTop - top) < 1) return;
    settling.current = true;
    easeScroll(el, top, () => {
      settling.current = false;
    });
  }, [value, values]);

  function releaseSelection() {
    window.getSelection()?.removeAllRanges();
  }

  function follow() {
    const el = scroller.current;
    const active = drag.current;
    if (!el || !active) return;
    el.scrollTop += (active.target - el.scrollTop) * 0.62;
    if (Math.abs(active.target - el.scrollTop) > 0.4) {
      active.frame = requestAnimationFrame(follow);
    } else {
      active.frame = 0;
    }
  }

  function finish() {
    const el = scroller.current;
    const active = drag.current;
    if (active) cancelAnimationFrame(active.frame);
    drag.current = null;
    document.body.style.userSelect = "";
    if (!el || values.length === 0) return;
    const index = clampIndex(Math.round(el.scrollTop / ITEM), values.length);
    settling.current = true;
    easeScroll(el, index * ITEM, () => {
      settling.current = false;
      const next = values[index];
      if (next && next !== value) onChange(next);
    });
  }

  return (
    <div className="relative h-[120px] w-16 select-none overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-10 -translate-y-1/2 border-y border-white/30"
      />
      <div
        ref={scroller}
        role="listbox"
        aria-label={ariaLabel}
        className="h-full select-none overflow-y-auto overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          const el = scroller.current;
          if (!el) return;
          event.preventDefault();
          releaseSelection();
          document.body.style.userSelect = "none";
          if (drag.current) cancelAnimationFrame(drag.current.frame);
          drag.current = {
            y: event.clientY,
            top: el.scrollTop,
            target: el.scrollTop,
            frame: 0,
          };
          el.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active) return;
          event.preventDefault();
          active.target = active.top - (event.clientY - active.y) * 1.85;
          cancelAnimationFrame(active.frame);
          active.frame = requestAnimationFrame(follow);
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onDragStart={(event) => event.preventDefault()}
      >
        <div style={{ height: ITEM }} />
        {values.map((item) => (
          <div
            key={item}
            role="option"
            aria-selected={item === value}
            className={
              "flex h-10 select-none items-center justify-center font-black " +
              (item === value ? "text-2xl text-white" : "text-sm text-white/35")
            }
          >
            {item}
          </div>
        ))}
        <div style={{ height: ITEM }} />
      </div>
    </div>
  );
}

function easeScroll(el: HTMLElement, top: number, done: () => void) {
  const start = el.scrollTop;
  const delta = top - start;
  if (Math.abs(delta) < 0.5) {
    el.scrollTop = top;
    done();
    return;
  }
  const began = performance.now();
  const step = (now: number) => {
    const t = Math.min(1, (now - began) / 240);
    const eased = 1 - (1 - t) ** 3;
    el.scrollTop = start + delta * eased;
    if (t < 1) requestAnimationFrame(step);
    else done();
  };
  requestAnimationFrame(step);
}

/** Hour and minute drums. Only times inside center hours are listed. */
export function SupportTimeWheel({
  hours,
  value,
  onChange,
}: {
  hours: CenterHours | null;
  value: string;
  onChange: (next: string) => void;
}) {
  const times = useMemo(() => lessonStartTimes(hours), [hours]);
  const hoursList = useMemo(() => [...new Set(times.map((time) => time.slice(0, 2)))], [times]);
  const hour = value.slice(0, 2);
  const minute = value.slice(3, 5);
  const minutes = useMemo(
    () => times.filter((time) => time.startsWith(`${hour}:`)).map((time) => time.slice(3, 5)),
    [times, hour],
  );

  useEffect(() => {
    if (times.length === 0) return;
    if (!times.includes(value)) onChange(times[0]);
  }, [times, value, onChange]);

  if (times.length === 0) {
    return <p className="text-xs font-bold text-white">Center hours are not set yet.</p>;
  }

  return (
    <div className="flex select-none items-center gap-1 text-white">
      <WheelColumn
        values={hoursList}
        value={hoursList.includes(hour) ? hour : hoursList[0]}
        ariaLabel="Hour"
        onChange={(nextHour) => {
          const same = times.find((time) => time.startsWith(`${nextHour}:`) && time.endsWith(minute));
          onChange(same ?? times.find((time) => time.startsWith(`${nextHour}:`)) ?? times[0]);
        }}
      />
      <span className="text-2xl font-black text-white">:</span>
      <WheelColumn
        values={minutes}
        value={minutes.includes(minute) ? minute : minutes[0]}
        ariaLabel="Minute"
        onChange={(nextMinute) => onChange(`${hour}:${nextMinute}`)}
      />
    </div>
  );
}
