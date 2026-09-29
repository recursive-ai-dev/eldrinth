import { useCallback, useEffect, useRef, useState } from "react";
import GameCanvas from "@/components/GameCanvas";
import HUD from "@/components/HUD";
import DialogueBox from "@/components/DialogueBox";
import Journal from "@/components/Journal";
import PauseOverlay from "@/components/PauseOverlay";
import VirtualControls from "@/components/VirtualControls";
import TitleScreen from "@/components/TitleScreen";
import EndScreen from "@/components/EndScreen";
import IntroSequence from "@/components/IntroSequence";
import ContentWarning, { contentWarningSeen, markContentWarningSeen } from "@/components/ContentWarning";
import { useGameStore, selectScreen, selectPaused, selectHud, selectDialogue, selectJournal, selectSessionId, selectEnding, selectEpilogue } from "@/stores";
import type { GameCallbacks } from "@/game/types";
import type { Game } from "@/game/engine";
import type { WorldSnapshot } from "@/game/core/WorldState";
import { slotStore, type SaveSlot, type PersistenceStatus } from "@/game/slots";
import { type Difficulty, normalizeDifficulty } from "@/game/types";


export default function App() {
  const screen = useGameStore(selectScreen);
  const paused = useGameStore(selectPaused);
  const hud = useGameStore(selectHud);
  const dialogue = useGameStore(selectDialogue);
  const journal = useGameStore(selectJournal);
  const sessionId = useGameStore(selectSessionId);
  const ending = useGameStore(selectEnding);
  const epilogue = useGameStore(selectEpilogue);
  const { startGame, endGame, setPaused, setHud, setDialogue, setJournal, setInterior } = useGameStore();
  const [journalOpen, setJournalOpen] = useState(false);
  const [checkpoint, setCheckpoint] = useState<WorldSnapshot | null>(null);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [slotsReady, setSlotsReady] = useState(false);
  const [slotBusy, setSlotBusy] = useState(false);
  const slotBusyRef = useRef(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [introPlaying, setIntroPlaying] = useState(false);
  const [warned, setWarned] = useState(() => contentWarningSeen());
  const [persistence, setPersistence] = useState<PersistenceStatus>({ ok: true, reason: null, cause: null });
  const [slotError, setSlotError] = useState<string | null>(null);

  const refreshSlots = useCallback(() => {
    return slotStore.list().then((records) => { setSlots(records); setSlotsReady(true); }).catch((error: unknown) => {
      setSlotsReady(false);
      console.error("Failed to list saves:", error);
      setSlotError("Save records could not be read. Please reload the page and try again.");
    });
  }, []);
  useEffect(() => {
    const refresh = () => { void refreshSlots(); };
    refresh();
    window.addEventListener("storage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("storage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshSlots]);

  // A browser that refuses to persist would otherwise look identical to a
  // working one until the player lost a run. Warn as soon as we know.
  useEffect(() => slotStore.onStatusChange(setPersistence), []);
  useEffect(() => { setSlotError(null); }, [screen]);

  const runSlotAction = useCallback((action: () => Promise<void>) => {
    if (!slotsReady || slotBusyRef.current) return;
    slotBusyRef.current = true;
    setSlotBusy(true);
    setSlotError(null);
    void action().catch((error: unknown) => {
      console.error("Save record action failed:", error);
      setSlotError(error instanceof Error ? error.message : "The save record could not be read or changed.");
    }).finally(() => {
      slotBusyRef.current = false;
      setSlotBusy(false);
    });
  }, [slotsReady]);

  const start = useCallback((slot: number, selectedDifficulty: Difficulty) => {
    runSlotAction(async () => {
      // Recheck the actual database, without ever deleting an existing record.
      await slotStore.prepareNew(slot);
      setCheckpoint(null);
      setActiveSlot(slot);
      setDifficulty(selectedDifficulty);
      setIntroPlaying(true);
    });
  }, [runSlotAction]);

  const finishIntro = useCallback(() => {
    setIntroPlaying(false);
    startGame();
  }, [startGame]);

  const resume = useCallback((slot: number) => {
    runSlotAction(async () => {
      const saved = await slotStore.load(slot);
      if (!saved) {
        setSlotError("That record could not be read. It may be damaged, or written by a newer version of the game.");
        return;
      }
      setCheckpoint(saved.world);
      setActiveSlot(slot);
      setDifficulty(normalizeDifficulty(saved.difficulty));
      startGame();
    });
  }, [runSlotAction, startGame]);

  const restart = useCallback(() => {
    // Restart has to drop the checkpoint. Leaving it in place made
    // "Abandon & Restart" reload the last autosave instead of starting over,
    // which silently rewinds the run and is the only in-game way back from a
    // bad state.
    setCheckpoint(null);
    setJournalOpen(false);
    startGame();
  }, [startGame]);

  const saveCheckpoint = useCallback((snapshot: WorldSnapshot) => {
    // The outgoing canvas checkpoints during effect cleanup. A restart has
    // already advanced the session by then, so its snapshot must not replace
    // the new run's checkpoint or overwrite its slot.
    if (useGameStore.getState().sessionId !== sessionId) return;
    setCheckpoint(snapshot);
    if (activeSlot != null) void slotStore.save(activeSlot, snapshot).then(refreshSlots).catch((error: unknown) => {
      console.error("Failed to save checkpoint:", error);
      setSlotError(error instanceof Error ? error.message : "Progress could not be saved. Please reload the page and try again.");
    });
  }, [activeSlot, refreshSlots, sessionId]);

  const eraseSlot = useCallback((slot: number) => {
    runSlotAction(async () => {
      await slotStore.remove(slot);
      await refreshSlots();
    });
  }, [refreshSlots, runSlotAction]);

  const acknowledgeWarning = useCallback(() => {
    markContentWarningSeen();
    setWarned(true);
  }, []);

  const gameRef = useRef<Game | null>(null);
  const setJournalVisibility = useCallback((open: boolean) => {
    gameRef.current?.setJournalOpen(open);
    setJournalOpen(open);
  }, []);
  useEffect(() => {
    const toggleJournal = (event: KeyboardEvent) => {
      if (event.repeat) return;
      // Escape must close the journal even from inside the note field. The
      // target guard exists so typing "l" does not toggle the panel, but applied
      // first it also swallowed Escape and stranded the player in the textarea
      // behind an on-screen button that reads "ESC / L / CLOSE".
      if (event.key === "Escape" && journalOpen) {
        event.preventDefault();
        setJournalVisibility(false);
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (event.key.toLowerCase() === "l" && (screen === "overworld" || screen === "interior") && !dialogue) {
        event.preventDefault();
        setJournalVisibility(!journalOpen);
      }
    };
    window.addEventListener("keydown", toggleJournal);
    return () => window.removeEventListener("keydown", toggleJournal);
  }, [screen, dialogue, journalOpen, setJournalVisibility]);
  const callbacks: GameCallbacks = {
    onHud: (hudData) => setHud(hudData),
    onDialogue: (dialogueData) => setDialogue(dialogueData),
    onPause: (paused) => setPaused(paused),
    onEnd: (result, runEpilogue) => { setCheckpoint(null); endGame(result, runEpilogue); },
    onJournal: (entries) => setJournal(entries),
    onInterior: (inside) => setInterior(inside),
  };

  const showGame = screen === "overworld" || screen === "interior" || screen === "pause";

  return (
    <div className="app-root relative h-[100dvh] w-full overflow-hidden bg-black font-serif text-amber-50">
      {showGame && (
        <GameCanvas
          key={sessionId}
          callbacks={callbacks}
          initialSnapshot={checkpoint}
          onCheckpoint={saveCheckpoint}
          difficulty={difficulty}
          // A fresh engine starts with its journal closed; match it, or a journal
          // left open when the previous engine crashed covers a live world.
          onReady={(g) => { gameRef.current = g; setJournalOpen(false); }}
          onDispose={(g) => { if (gameRef.current === g) gameRef.current = null; }}
        />
      )}

      {showGame && <HUD hud={hud} />}

      {showGame && !paused && !dialogue && !journalOpen && (
        <VirtualControls
          onInput={(key, isDown) => gameRef.current?.setVirtualKey(key, isDown)}
          onToggleJournal={() => setJournalVisibility(!journalOpen)}
          onTogglePause={() => gameRef.current?.togglePause()}
        />
      )}

      {showGame && dialogue && (
        <DialogueBox
          data={dialogue}
          onAdvance={() => gameRef.current?.advanceDialogue()}
          onChoice={(id) => gameRef.current?.chooseDialogue(id)}
        />
      )}

      {showGame && journalOpen && (
        <Journal
          entries={journal}
          onClose={() => setJournalVisibility(false)}
          onAddNote={(note) => gameRef.current?.addPersonalNote(note)}
        />
      )}

      {showGame && paused && (
        <PauseOverlay
          onResume={() => gameRef.current?.setPaused(false)}
          onRestart={restart}
        />
      )}

      {slotError && (
        <div
          role="alert"
          data-testid="slot-error"
          className="absolute inset-x-0 top-0 z-[60] flex justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))]"
        >
          <p className="rounded border border-rose-500/40 bg-[#1a0f14]/95 px-4 py-2 font-serif text-sm text-rose-100 shadow-lg">
            {slotError}
          </p>
        </div>
      )}

      {!persistence.ok && persistence.reason && (
        <div
          role="status"
          data-testid="persistence-warning"
          className="absolute inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
        >
          <p className="rounded border border-amber-500/40 bg-[#1a1408]/95 px-4 py-2 font-serif text-sm text-amber-100 shadow-lg">
            Progress cannot be saved in this browser session. {persistence.reason}
          </p>
        </div>
      )}

      {!warned && <ContentWarning onAcknowledge={acknowledgeWarning} />}
      {warned && screen === "title" && !introPlaying && (
        <TitleScreen
          onStart={start}
          onContinue={resume}
          onErase={eraseSlot}
          slots={slots}
          slotsReady={slotsReady}
          busy={slotBusy}
          savingUnavailable={!persistence.ok}
        />
      )}
      {warned && screen === "title" && introPlaying && <IntroSequence onComplete={finishIntro} />}
      {screen === "ending" && ending && <EndScreen ending={ending} epilogue={epilogue} onRestart={restart} />}
    </div>
  );
}
