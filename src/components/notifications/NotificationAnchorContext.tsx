import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

type NotificationAnchorContextValue = {
  bellRef: RefObject<HTMLDivElement | null>;
  inboxRef: RefObject<HTMLDivElement | null>;
  pulseBell: () => void;
  registerPulse: (fn: () => void) => void;
  registerInboxRef: (el: HTMLDivElement | null) => void;
  flashInbox: () => void;
  registerFlashInbox: (fn: () => void) => void;
};

const NotificationAnchorContext = createContext<NotificationAnchorContextValue | null>(null);

export function NotificationAnchorProvider({ children }: { children: ReactNode }) {
  const bellRef = useRef<HTMLDivElement | null>(null);
  const inboxRef = useRef<HTMLDivElement | null>(null);
  const pulseFnRef = useRef<(() => void) | null>(null);
  const flashInboxFnRef = useRef<(() => void) | null>(null);

  const registerPulse = useCallback((fn: () => void) => {
    pulseFnRef.current = fn;
  }, []);

  const registerFlashInbox = useCallback((fn: () => void) => {
    flashInboxFnRef.current = fn;
  }, []);

  const registerInboxRef = useCallback((el: HTMLDivElement | null) => {
    inboxRef.current = el;
  }, []);

  const pulseBell = useCallback(() => {
    pulseFnRef.current?.();
  }, []);

  const flashInbox = useCallback(() => {
    flashInboxFnRef.current?.();
  }, []);

  const value = useMemo(
    () => ({
      bellRef,
      inboxRef,
      pulseBell,
      registerPulse,
      registerInboxRef,
      flashInbox,
      registerFlashInbox,
    }),
    [pulseBell, registerPulse, registerInboxRef, flashInbox, registerFlashInbox],
  );

  return (
    <NotificationAnchorContext.Provider value={value}>{children}</NotificationAnchorContext.Provider>
  );
}

export function useNotificationAnchor() {
  const ctx = useContext(NotificationAnchorContext);
  if (!ctx) {
    throw new Error("useNotificationAnchor must be used within NotificationAnchorProvider");
  }
  return ctx;
}

export function useNotificationAnchorOptional() {
  return useContext(NotificationAnchorContext);
}
