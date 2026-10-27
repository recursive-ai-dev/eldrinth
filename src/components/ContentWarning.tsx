import { useEffect, useRef } from "react";

export const CONTENT_WARNING_KEY = "eldrinth:content-warning:v1";

/** localStorage can throw in private windows; a failed read simply shows the notice again. */
export function contentWarningSeen(): boolean {
  try {
    return window.localStorage.getItem(CONTENT_WARNING_KEY) === "1";
  } catch {
    return false;
  }
}

export function markContentWarningSeen() {
  try {
    window.localStorage.setItem(CONTENT_WARNING_KEY, "1");
  } catch {
    // A viewer who cannot persist the acknowledgement simply sees it again.
  }
}

export default function ContentWarning({ onAcknowledge }: { onAcknowledge: () => void }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      // A held key is not a second decision. Without this, the auto-repeat of
      // the Enter that dismissed this notice fell through to the title screen.
      if (e.repeat) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onAcknowledge();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onAcknowledge]);
  useEffect(() => {
    buttonRef.current?.focus();
  }, []);

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black px-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="content-warning-heading"
    >
      <div className="max-w-xl text-center">
        <h1 id="content-warning-heading" className="font-title text-2xl tracking-[0.3em] text-rose-200/90">BEFORE YOU BEGIN</h1>
        <p className="mt-8 font-serif text-base leading-relaxed text-amber-50/80">
          Eldrinth is a story about people who built a machine out of other people and
          then wrote it down neatly. It contains institutional violence and death,
          described plainly and in the administrative language the
          institutions used.
        </p>
        <p className="mt-4 font-serif text-base leading-relaxed text-amber-50/80">
          None of it is here to be enjoyed. None of it is softened either.
        </p>
        <button
          ref={buttonRef}
          onClick={onAcknowledge}
          className="mt-10 rounded-lg border border-rose-300/40 bg-rose-400/10 px-10 py-4 font-title text-base tracking-[0.3em] text-rose-50 transition hover:bg-rose-400/20"
        >
          I UNDERSTAND
        </button>
      </div>
    </div>
  );
}
