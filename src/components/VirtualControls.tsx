import { useEffect, useState, useCallback } from "react";

interface VirtualControlsProps {
  onInput: (key: string, isDown: boolean) => void;
  onToggleJournal?: () => void;
  onTogglePause?: () => void;
}

export default function VirtualControls({
  onInput,
  onToggleJournal,
  onTogglePause,
}: VirtualControlsProps) {
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const hasTouch =
      "ontouchstart" in window ||
      (typeof navigator !== "undefined" && navigator.maxTouchPoints > 0) ||
      window.matchMedia("(pointer: coarse)").matches;
    setIsTouchDevice(hasTouch);
  }, []);

  const handlePointerDown = useCallback(
    (key: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      onInput(key, true);
    },
    [onInput]
  );

  const handlePointerUp = useCallback(
    (key: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Pointer may have already been released
      }
      onInput(key, false);
    },
    [onInput]
  );

  const handlePointerCancel = useCallback(
    (key: string) => (e: React.PointerEvent) => {
      e.preventDefault();
      try {
        (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
      } catch {
        // Pointer may have already been released
      }
      onInput(key, false);
    },
    [onInput]
  );

  // If not a touch device and not forced, keep hidden on large fine-pointer screens,
  // but allow it to render if touch is present or viewport is compact.
  if (!isTouchDevice) {
    return (
      <div className="pointer-events-none absolute inset-0 z-30 block sm:hidden">
        {/* Rendered only on compact viewports if touch query didn't trigger */}
      </div>
    );
  }

  return (
    <div
      data-testid="virtual-controls"
      className="pointer-events-none absolute inset-0 z-30 select-none touch-none overflow-hidden [-webkit-touch-callout:none]"
    >
      {/* Top action shortcuts for Journal & Pause */}
      <div className="pointer-events-auto absolute inset-safe-t inset-safe-r flex gap-2 sm:hidden">
        <button
          type="button"
          aria-label="Journal"
          onClick={onToggleJournal}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/30 bg-black/60 font-serif text-xs font-bold text-amber-200 shadow-md backdrop-blur-sm active:scale-95 active:bg-amber-900/40"
        >
          CODEX
        </button>
        <button
          type="button"
          aria-label="Pause"
          onClick={onTogglePause}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-stone-400/30 bg-black/60 font-serif text-xs font-bold text-stone-200 shadow-md backdrop-blur-sm active:scale-95 active:bg-stone-800"
        >
          II
        </button>
      </div>

      {/* Bottom-left: Directional D-Pad */}
      <div className="pointer-events-auto absolute inset-safe-b inset-safe-l flex h-36 w-36 items-center justify-center">
        <div className="relative h-32 w-32 rounded-full border border-amber-400/20 bg-black/40 backdrop-blur-md shadow-lg">
          {/* Up */}
          <button
            type="button"
            aria-label="Up"
            onPointerDown={handlePointerDown("w")}
            onPointerUp={handlePointerUp("w")}
            onPointerCancel={handlePointerCancel("w")}
            className="absolute top-1 left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/30 bg-black/60 text-amber-200 shadow-sm active:bg-amber-600/40"
          >
            ▲
          </button>
          {/* Down */}
          <button
            type="button"
            aria-label="Down"
            onPointerDown={handlePointerDown("s")}
            onPointerUp={handlePointerUp("s")}
            onPointerCancel={handlePointerCancel("s")}
            className="absolute bottom-1 left-1/2 -translate-x-1/2 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/30 bg-black/60 text-amber-200 shadow-sm active:bg-amber-600/40"
          >
            ▼
          </button>
          {/* Left */}
          <button
            type="button"
            aria-label="Left"
            onPointerDown={handlePointerDown("a")}
            onPointerUp={handlePointerUp("a")}
            onPointerCancel={handlePointerCancel("a")}
            className="absolute left-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/30 bg-black/60 text-amber-200 shadow-sm active:bg-amber-600/40"
          >
            ◀
          </button>
          {/* Right */}
          <button
            type="button"
            aria-label="Right"
            onPointerDown={handlePointerDown("d")}
            onPointerUp={handlePointerUp("d")}
            onPointerCancel={handlePointerCancel("d")}
            className="absolute right-1 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-lg border border-amber-300/30 bg-black/60 text-amber-200 shadow-sm active:bg-amber-600/40"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Bottom-right: Action Buttons */}
      <div className="pointer-events-auto absolute bottom-8 right-6 flex items-end gap-3">
        {/* Interact / Talk */}
        <button
          type="button"
          aria-label="Interact"
          onPointerDown={handlePointerDown("e")}
          onPointerUp={handlePointerUp("e")}
          onPointerCancel={handlePointerCancel("e")}
          className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-teal-400/40 bg-teal-950/60 font-serif text-[11px] font-bold tracking-wider text-teal-200 shadow-[0_0_15px_rgba(45,212,191,0.2)] backdrop-blur-md active:scale-95 active:bg-teal-800/80"
        >
          <span>TALK</span>
          <span className="text-[9px] text-teal-300/60">[E]</span>
        </button>

        {/* Dash */}
        <button
          type="button"
          aria-label="Dash"
          onPointerDown={handlePointerDown("shift")}
          onPointerUp={handlePointerUp("shift")}
          onPointerCancel={handlePointerCancel("shift")}
          className="flex h-14 w-14 flex-col items-center justify-center rounded-full border border-cyan-400/40 bg-cyan-950/60 font-serif text-[11px] font-bold tracking-wider text-cyan-200 shadow-[0_0_15px_rgba(6,182,212,0.2)] backdrop-blur-md active:scale-95 active:bg-cyan-800/80"
        >
          <span>DASH</span>
          <span className="text-[9px] text-cyan-300/60">[SHIFT]</span>
        </button>

        {/* Attack */}
        <button
          type="button"
          aria-label="Attack"
          onPointerDown={handlePointerDown(" ")}
          onPointerUp={handlePointerUp(" ")}
          onPointerCancel={handlePointerCancel(" ")}
          className="flex h-16 w-16 flex-col items-center justify-center rounded-full border border-rose-500/50 bg-rose-950/70 font-serif text-xs font-bold tracking-widest text-rose-200 shadow-[0_0_20px_rgba(244,63,94,0.3)] backdrop-blur-md active:scale-95 active:bg-rose-800/80"
        >
          <span>ATK</span>
          <span className="text-[9px] text-rose-300/60">[SPC]</span>
        </button>
      </div>
    </div>
  );
}

