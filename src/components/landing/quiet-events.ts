import type { EventManager, Events } from "@react-three/fiber";

/**
 * R3F's default pointer layer copies every field of the browser event. Firefox
 * throws "may not load or link to file:///" while reading that copy, so
 * decorative scenes do not connect the pointer system at all.
 */
const noop = () => undefined;

const handlers: Events = {
  onClick: noop,
  onContextMenu: noop,
  onDoubleClick: noop,
  onWheel: noop,
  onPointerDown: noop,
  onPointerUp: noop,
  onPointerLeave: noop,
  onPointerMove: noop,
  onPointerCancel: noop,
  onLostPointerCapture: noop,
};

export function quietEvents(): EventManager<HTMLElement> {
  const manager: EventManager<HTMLElement> = {
    enabled: false,
    priority: 0,
    compute() {},
    handlers,
    connect(target) {
      manager.connected = target;
    },
    disconnect() {
      manager.connected = undefined;
    },
    update() {},
  };
  return manager;
}
