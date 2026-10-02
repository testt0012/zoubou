"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

const NOTICE_MS = 7000;

type Notify = (message: string) => void;

const AdminNoticeContext = createContext<Notify>(() => {});

// Something that didn't work, said out loud: a bar across the top of the
// admin (above any sheet that is open) that goes away by itself after a few
// seconds. Use it for any admin action that can fail — otherwise the screen
// looks as if it had worked.
export function useAdminNotice(): Notify {
  return useContext(AdminNoticeContext);
}

export default function AdminNoticeProvider({ children }: { children: React.ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback<Notify>((text) => {
    if (timer.current) clearTimeout(timer.current);
    setMessage(text);
    timer.current = setTimeout(() => setMessage(null), NOTICE_MS);
  }, []);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const value = useMemo(() => notify, [notify]);

  return (
    <AdminNoticeContext.Provider value={value}>
      {children}
      {message && (
        <div
          role="alert"
          className="fixed inset-x-4 top-[max(1rem,env(safe-area-inset-top))] z-[70] mx-auto max-w-md rounded-xl bg-red-600 px-4 py-3 text-sm text-white shadow-lg flex items-start gap-3"
        >
          <span className="flex-1">{message}</span>
          <button
            type="button"
            onClick={() => setMessage(null)}
            aria-label="Κλείσιμο"
            className="shrink-0 text-white/80 text-lg leading-none px-1"
          >
            ×
          </button>
        </div>
      )}
    </AdminNoticeContext.Provider>
  );
}
