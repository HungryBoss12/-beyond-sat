import { describe, expect, it } from "vitest";
import { placeNotificationInbox } from "./place-inbox";

describe("placeNotificationInbox", () => {
  it("aligns a wide screen to the bell", () => {
    const box = placeNotificationInbox({ right: 900, bottom: 64 }, { width: 1280, height: 800 });
    expect(box.width).toBe(420);
    expect(box.left).toBe(480);
    expect(box.top).toBe(72);
    expect(box.left + box.width).toBeLessThanOrEqual(1280 - 8);
  });

  it("stays on screen when the bell is near the left", () => {
    const box = placeNotificationInbox({ right: 220, bottom: 64 }, { width: 390, height: 700 });
    expect(box.left).toBeGreaterThanOrEqual(8);
    expect(box.left + box.width).toBeLessThanOrEqual(390 - 8);
    expect(box.width).toBe(390 - 16);
  });
});
