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
import { readDisplayPreferences, saveDisplayPreferences, type DisplayPreferences } from "@/components/displayPreferences";
import WorldAtmosphere from "@/components/WorldAtmosphere";
import { useSoundscape } from "@/audio/useSoundscape";
import SoundSettings from "@/audio/SoundSettings";
import Atlas from "@/components/Atlas";
import { readTravelPreferences, saveTravelPreferences, type TravelPreferences } from "@/components/travelPreferences";
import "@/components/travel.css";


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
  const [atlasOpen, setAtlasOpen] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
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
  const [preferences, setPreferences] = useState(readDisplayPreferences);
  const [preferencesSaved, setPreferencesSaved] = useState(true);
  const [travelPreferences, setTravelPreferences] = useState(readTravelPreferences);
  const [travelPreferencesSaved, setTravelPreferencesSaved] = useState(true);
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);

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
    setAtlasOpen(false);
    setPinnedId(null);
    startGame();
  }, [startGame]);

  const saveCheckpoint = useCallback((snapshot: WorldSnapshot) => {
    // The outgoing canvas checkpoints during effect cleanup. A restart has
    // already advanced the session by then, so its snapshot must not replace
    // the new run's checkpoint or overwrite its slot.
    if (useGameStore.getState().sessionId !== sessionId) return;
    setCheckpoint(snapshot);
    if (activeSlot != null) return slotStore.save(activeSlot, snapshot).then(async () => {
      setSlotError(null);
      setLastSavedAt(Date.now());
      await refreshSlots();
    }).catch((error: unknown) => {
      console.error("Failed to save checkpoint:", error);
      setSlotError(error instanceof Error ? error.message : "Progress could not be saved. Please reload the page and try again.");
      throw error;
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
  const changePreferences = useCallback((next: DisplayPreferences) => {
    setPreferences(next);
    setPreferencesSaved(saveDisplayPreferences(next));
    gameRef.current?.setCameraZoom(next.cameraZoom);
  }, []);
  const changeTravelPreferences = useCallback((next: TravelPreferences) => {
    setTravelPreferences(next);
    setTravelPreferencesSaved(saveTravelPreferences(next));
    if (gameRef.current) {
      gameRef.current.autoPause = next.autoPause;
      gameRef.current.screenShake = next.screenShake;
      if (!next.screenShake) gameRef.current.shakeMag = 0;
    }
  }, []);
  const saveCurrentCheckpoint = useCallback(async () => {
    const game = gameRef.current;
    if (!game || !game.initialized || game.ended) throw new Error("The world is still opening. Please try again in a moment.");
    if (game.regionTransition) await game.regionTransition;
    await saveCheckpoint(game.saveWorld());
  }, [saveCheckpoint]);
  const saveAndReturnToTitle = useCallback(async () => {
    const game = gameRef.current;
    if (!game || !game.initialized) throw new Error("The world is still opening. Please try again in a moment.");
    if (game.regionTransition) await game.regionTransition;
    await saveCheckpoint(game.saveWorld());
    if (gameRef.current !== game) return;
    setJournalOpen(false);
    setAtlasOpen(false);
    useGameStore.getState().reset();
  }, [saveCheckpoint]);
  const setJournalVisibility = useCallback((open: boolean) => {
    gameRef.current?.setJournalOpen(open);
    setAtlasOpen(false);
    setJournalOpen(open);
  }, []);
  const setAtlasVisibility = useCallback((open: boolean) => {
    gameRef.current?.setJournalOpen(open);
    setJournalOpen(false);
    setAtlasOpen(open);
  }, []);
  useEffect(() => {
    const pauseHidden = () => {
      if (document.visibilityState === "hidden") gameRef.current?.onBlur();
    };
    document.addEventListener("visibilitychange", pauseHidden);
    return () => document.removeEventListener("visibilitychange", pauseHidden);
  }, []);
  useEffect(() => {
    const toggleJournal = (event: KeyboardEvent) => {
      if (event.repeat) return;
      // Escape must close the journal even from inside the note field. The
      // target guard exists so typing "l" does not toggle the panel, but applied
      // first it also swallowed Escape and stranded the player in the textarea
      // behind an on-screen button that reads "ESC / L / CLOSE".
      if (event.key === "Escape" && atlasOpen) {
        event.preventDefault();
        setAtlasVisibility(false);
        return;
      }
      if (event.key === "Escape" && journalOpen) {
        event.preventDefault();
        setJournalVisibility(false);
        return;
      }
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (event.key.toLowerCase() === "m" && (screen === "overworld" || screen === "interior") && !dialogue) {
        event.preventDefault();
        setAtlasVisibility(!atlasOpen);
        return;
      }
      if (event.key.toLowerCase() === "l" && (screen === "overworld" || screen === "interior") && !dialogue) {
        event.preventDefault();
        setJournalVisibility(!journalOpen);
      }
    };
    window.addEventListener("keydown", toggleJournal);
    return () => window.removeEventListener("keydown", toggleJournal);
  }, [screen, dialogue, journalOpen, atlasOpen, setJournalVisibility, setAtlasVisibility]);
  const callbacks: GameCallbacks = {
    onHud: (hudData) => setHud(hudData),
    onDialogue: (dialogueData) => setDialogue(dialogueData),
    onPause: (paused) => setPaused(paused),
    onEnd: (result, runEpilogue) => { setCheckpoint(null); endGame(result, runEpilogue); },
    onJournal: (entries) => setJournal(entries),
    onInterior: (inside) => setInterior(inside),
  };

  const showGame = screen === "overworld" || screen === "interior" || screen === "pause";
  const sound = useSoundscape({ hud, active: showGame, paused: paused || journalOpen || atlasOpen, dialogue: !!dialogue });

  return (
    <div className={`app-root relative h-[100dvh] w-full overflow-hidden bg-black font-serif text-amber-50${preferences.largeText ? " large-reading" : ""}${preferences.quietInterface ? " quiet-interface" : ""}${travelPreferences.highContrast ? " high-contrast" : ""}`}>
      {showGame && (
        <GameCanvas
          key={sessionId}
          callbacks={callbacks}
          initialSnapshot={checkpoint}
          onCheckpoint={saveCheckpoint}
          difficulty={difficulty}
          // A fresh engine starts with its journal closed; match it, or a journal
          // left open when the previous engine crashed covers a live world.
          onReady={(g) => { gameRef.current = g; g.setCameraZoom(preferences.cameraZoom); g.autoPause = travelPreferences.autoPause; g.screenShake = travelPreferences.screenShake; setJournalOpen(false); setAtlasOpen(false); setPinnedId(null); setLastSavedAt(null); }}
          onDispose={(g) => { if (gameRef.current === g) gameRef.current = null; }}
        />
      )}

      {showGame && travelPreferences.atmosphere && <WorldAtmosphere region={hud.regionName} still={paused || journalOpen || atlasOpen || !!dialogue} />}
      {showGame && <HUD hud={hud} pinnedId={pinnedId} onAtlas={!paused && !dialogue && !journalOpen && !atlasOpen ? () => setAtlasVisibility(true) : undefined} onLantern={!paused && !dialogue && !journalOpen && !atlasOpen ? () => { gameRef.current?.toggleLantern(); } : undefined} onEquipment={!paused && !dialogue && !journalOpen && !atlasOpen ? () => gameRef.current?.setPaused(true) : undefined} />}

      {showGame && !paused && !dialogue && !journalOpen && !atlasOpen && (
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

      {showGame && atlasOpen && hud.navigation && <Atlas data={hud.navigation} pinnedId={pinnedId} onPin={setPinnedId} onClose={() => setAtlasVisibility(false)} />}

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
          onSaveAndReturn={saveAndReturnToTitle}
          onSave={saveCurrentCheckpoint}
          lastSavedAt={lastSavedAt}
          travelPreferences={travelPreferences}
          onTravelPreferences={changeTravelPreferences}
          travelPreferencesSaved={travelPreferencesSaved}
          equipment={hud.equipment}
          onRelic={(id) => gameRef.current?.equipRelic(id) ?? false}
          onTool={(id) => gameRef.current?.setCombatTool(id) ?? false}
          preferences={preferences}
          onPreferences={changePreferences}
          preferencesSaved={preferencesSaved}
          hud={hud}
          voices={hud.voices}
          soundSettings={<SoundSettings {...sound} />}
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
