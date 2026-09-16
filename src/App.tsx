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
import { useGameStore, selectScreen, selectPaused, selectHud, selectDialogue, selectJournal, selectSessionId, selectEnding } from "@/stores";
import type { GameCallbacks } from "@/game/types";
import type { Game } from "@/game/engine";
import type { WorldSnapshot } from "@/game/core/WorldState";
import { slotStore, type SaveSlot } from "@/game/slots";
import { type Difficulty, normalizeDifficulty } from "@/game/types";



export default function App() {
  const screen = useGameStore(selectScreen);
  const paused = useGameStore(selectPaused);
  const hud = useGameStore(selectHud);
  const dialogue = useGameStore(selectDialogue);
  const journal = useGameStore(selectJournal);
  const sessionId = useGameStore(selectSessionId);
  const ending = useGameStore(selectEnding);
  const { startGame, endGame, setPaused, setHud, setDialogue, setJournal, setInterior } = useGameStore();
  const [journalOpen, setJournalOpen] = useState(false);
  const [checkpoint, setCheckpoint] = useState<WorldSnapshot | null>(null);
  const [slots, setSlots] = useState<SaveSlot[]>([]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [difficulty, setDifficulty] = useState<Difficulty>("standard");
  const [introPlaying, setIntroPlaying] = useState(false);
  const [warned, setWarned] = useState(() => contentWarningSeen());

  const refreshSlots = useCallback(() => { void slotStore.list().then(setSlots).catch(() => setSlots([])); }, []);
  useEffect(() => { refreshSlots(); }, [refreshSlots]);

  const start = useCallback((slot: number, selectedDifficulty: Difficulty) => {
    setCheckpoint(null);
    setActiveSlot(slot);
    setDifficulty(selectedDifficulty);
    void slotStore.remove(slot).then(refreshSlots).catch(() => undefined);
    setIntroPlaying(true);
  }, [refreshSlots]);

  const finishIntro = useCallback(() => {
    setIntroPlaying(false);
    startGame();
  }, [startGame]);

  const resume = useCallback((slot: number) => {
    void slotStore.load(slot).then((saved) => {
      if (!saved) return;
      setCheckpoint(saved.world);
      setActiveSlot(slot);
      setDifficulty(normalizeDifficulty(saved.difficulty));
      startGame();
    });
  }, [startGame]);

  const restart = useCallback(() => {
    startGame();
  }, [startGame]);

  const saveCheckpoint = useCallback((snapshot: WorldSnapshot) => {
    setCheckpoint(snapshot);
    if (activeSlot) void slotStore.save(activeSlot, snapshot).then(refreshSlots).catch(() => undefined);
  }, [activeSlot, refreshSlots]);

  const eraseSlot = useCallback((slot: number) => {
    void slotStore.remove(slot).then(refreshSlots).catch(() => undefined);
  }, [refreshSlots]);

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
      const target = event.target;
      if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable)) return;
      if (event.key === "Escape" && journalOpen) {
        event.preventDefault();
        setJournalVisibility(false);
        return;
      }
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
    onEnd: (result) => { setCheckpoint(null); endGame(result); },
    onJournal: (entries) => setJournal(entries),
    onInterior: (inside) => setInterior(inside),
  };

  const showGame = screen === "overworld" || screen === "interior" || screen === "pause";

  return (
    <div className="no-select relative h-screen w-screen overflow-hidden bg-black font-serif text-amber-50">
      {showGame && (
        <GameCanvas
          key={sessionId}
          callbacks={callbacks}
          initialSnapshot={checkpoint}
          onCheckpoint={saveCheckpoint}
          difficulty={difficulty}
          onReady={(g) => { gameRef.current = g; }}
        />
      )}

      {showGame && <HUD hud={hud} />}

      {showGame && !paused && !dialogue && !journalOpen && (
        <VirtualControls
          onInput={(key, isDown) => gameRef.current?.setVirtualKey(key, isDown)}
          onToggleJournal={() => setJournalVisibility(!journalOpen)}
          onTogglePause={() => setPaused(!paused)}
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

      {!warned && <ContentWarning onAcknowledge={acknowledgeWarning} />}
      {warned && screen === "title" && !introPlaying && <TitleScreen onStart={start} onContinue={resume} onErase={eraseSlot} slots={slots} />}
      {warned && screen === "title" && introPlaying && <IntroSequence onComplete={finishIntro} />}
      {screen === "ending" && ending && <EndScreen ending={ending} onRestart={restart} />}
    </div>
  );
}
