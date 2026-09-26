import { useEffect, useRef, type ReactNode } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Dialog semantics for the overlay panels.
 *
 * The pause menu, journal and ending screen all cover the game, but none of them
 * announced itself as a dialog: a screen reader never learned that the world had
 * been suspended, and Tab walked straight out of the panel into the HUD behind
 * it. This moves focus in on open, keeps it in while the panel is up, and puts
 * it back on the way out.
 *
 * Escape is deliberately not handled here — every one of these panels is opened
 * and closed by its own key handler in the shell, and two Escape listeners
 * fighting over one keypress is how the journal's "ESC / L / CLOSE" hint became
 * a lie.
 */
export default function Modal({
  labelledBy,
  children,
  className = "",
  onKeyDown,
}: {
  labelledBy: string;
  children: ReactNode;
  className?: string;
  onKeyDown?: (event: React.KeyboardEvent) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const first = node.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? node).focus();

    const onDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const focusable = [...node.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === document.activeElement,
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    };

    document.addEventListener("keydown", onDocumentKeyDown);
    return () => {
      document.removeEventListener("keydown", onDocumentKeyDown);
      previouslyFocused?.focus?.();
    };
  }, []);

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className={className}
    >
      {children}
    </div>
  );
}
