import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialSupportDay } from "@/lib/support/desk";
import { AdminDesk } from "./AdminDesk";
import { SupportHandoff } from "./SupportHandoff";
import { SupportMonthCalendar } from "./SupportMonthCalendar";
import { SupportReceivedDesk } from "./SupportReceivedDesk";

describe("SupportReceivedDesk & SupportHandoff initial render", () => {
  it("selects today in Tashkent immediately and renders the day schedule without waiting on subject", () => {
    const today = initialSupportDay();
    const html = renderToStaticMarkup(createElement(SupportReceivedDesk));

    // Must not show the dead support_received empty message from the screenshot.
    expect(html).not.toContain("No students have been sent to you yet.");
    // Both Booked and Students tabs must be available immediately in the top panel.
    expect(html).toContain('role="tablist"');
    expect(html).toContain("Booked");
    expect(html).toContain("Students");
    expect(html).toContain("Loading bookings");
    // Today's cell must already be selected so today's bookings load immediately.
    expect(html).toContain(`data-day="${today}"`);
    expect(html).toContain('aria-pressed="true"');
    // The day handoff schedule mounts right away and shows a loading state instead of a false empty state.
    expect(html).toContain("Loading sessions");
    expect(html).not.toContain("No slots opened for this day.");
  });

  it("shows a loading message in SupportHandoff instead of claiming no slots or bookings exist", () => {
    const futureHtml = renderToStaticMarkup(
      createElement(SupportHandoff, { day: "2099-11-17", selfSubject: "ebrw" }),
    );
    expect(futureHtml).toContain("Loading sessions");
    expect(futureHtml).not.toContain("No slots opened for this day.");

    const pastHtml = renderToStaticMarkup(
      createElement(SupportHandoff, { day: "2020-11-17", selfSubject: "ebrw" }),
    );
    expect(pastHtml).toContain("Loading sessions");
    expect(pastHtml).not.toContain("No one is booked this day.");
  });

  it("renders booking count badges on calendar days with bookings and keeps every day selectable", () => {
    const html = renderToStaticMarkup(
      createElement(SupportMonthCalendar, {
        month: new Date(2026, 10, 17),
        selectedDay: "2026-11-17",
        todayKey: "2026-11-17",
        counts: { "2026-11-16": 4, "2026-11-17": 3 },
        onMonthChange: () => {},
        onSelectDay: () => {},
      }),
    );
    expect(html).toContain('aria-label="2026-11-17, 3 booked sessions"');
    expect(html).toContain('aria-label="2026-11-16, 4 booked sessions"');
    expect(html).toContain('data-booked-count="3"');
    expect(html).toContain('data-booked-count="4"');
    expect(html).not.toContain("disabled");
  });

  it("opens today immediately on AdminDesk and never disables calendar days from Setup checkboxes", () => {
    const today = initialSupportDay();
    const html = renderToStaticMarkup(createElement(AdminDesk));
    expect(html).toContain(`data-day="${today}"`);
    expect(html).toContain("Loading sessions");
    expect(html).not.toContain("cursor-not-allowed");
  });
});
