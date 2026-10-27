# The Harvest Narrative Rewrite Implementation Plan

> Narrative revision (2026-10-27): child killing and child harvesting are excluded. All harvested people are adults; Roryn is an adult wagoner. Historical child-victim material below is superseded and must not be reintroduced. See current source and ROADMAP.md.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Eldrinth's premise and every line of text so that gathering
the nine shards and killing the Unbound become atrocities the player commits,
not services they render.

**Architecture:** Mechanical work first (optional quest rewards, a three-way
ending replacing the `win`/`lose` binary, a refusal dialogue gate at the ward,
a content-warning screen, escalating journal bleed), then the prose rewrite
site by site. The mechanical tasks are test-driven; the prose tasks are
verified by type-check, suite, and a headless playthrough. No new art, no new
combat systems, no map geometry changes.

**Tech Stack:** TypeScript, React 19, Zustand, Vite, Vitest, Canvas2D.

**Spec:** `docs/superpowers/specs/2026-09-13-the-harvest-narrative-design.md`

## Global Constraints

- **Content rating is hard M.** Profanity is load-bearing, not decorative.
  Atrocity is described in institutional vocabulary. Nothing is staged for
  the player's enjoyment.
- **Orithel never swears, ever.** His register is administrative:
  `intake`, `yield`, `rolls`, `the program`, `units`, `permitted wastage`,
  `reconciliation`. His warmth is sincere. That is what makes it work.
- **These strings are kept verbatim and must not be edited:** intro shot 4
  in `IntroSequence.tsx` (`"You have come for the nine pieces."` /
  `"I don't remember coming before."` / `"You never do."` /
  `THE NINTH MEMORY IS NOT MINE`), intro shot 5's `ELDRINTH` /
  `THE UNBOUND SPIRE` / `SOME DOORS ONLY OPEN FROM THE INSIDE` /
  `OPEN YOUR EYES`, the ending titles `THE SPIRE FALLS SILENT` and
  `YOUR LIGHT FADES`, and the ending buttons `WALK AGAIN` and `RISE AGAIN`.
  Their whole effect depends on being the same triumphant lines the game
  already ships.
- **The sexual-violence reference is one narrative beat, at the salt-graves
  ledger, and nowhere else.** It records a permission rather than an act,
  carries no physical detail, and no character ever comments on it. Because
  the game mirrors every discovery site into a quest evidence entry, that
  one beat exists in exactly two code locations and must be worded
  identically in both: `salt-graves` evidence in `quests.ts` (Task 8) and
  the matching sign in `map.ts` (Task 9). Task 12 verifies that count. It
  must appear nowhere else — not in the beacon confession, not in any
  resolution, not in Orithel's mouth.
- **`quests.ts`'s structure does not change.** Same `QuestDefinition` shape,
  same `fact` IDs (`courier-orders`, `courier-memory`, `salt-graves`,
  `salt-beacon`, `dawn-record`, `warden:starfall-moors`), same reward
  stat/amount pairs. Only copy changes, plus the one new choice in Task 1.
- Run `npx vitest run` and `npx tsc --noEmit` before every commit.

---

### Task 1: Optional quest rewards and the courier's third choice

The `end` choice is the first choice in the game that pays nothing. It must
not be softened with a hidden bonus.

**Files:**
- Modify: `src/game/quests.ts:13` (the `QuestDefinition` interface), `:24-27` (courier choices)
- Modify: `src/game/engine.ts:1106-1112` (reward application in `chooseDialogue`)
- Test: `src/game/quests.test.ts`

**Interfaces:**
- Produces: `QuestDefinition["choices"][number]["reward"]` becomes optional —
  `reward?: { stat: "health" | "stamina" | "blade" | "dash"; amount: number }`.
  Every later task and every consumer must treat it as possibly absent.
- Consumes: nothing from earlier tasks.

- [ ] **Step 1: Write the failing test**

Add to `src/game/quests.test.ts`:

```typescript
  it("resolves the courier's rewardless choice and records it", () => {
    const progress: QuestProgress = { facts: [], resolutions: {} };
    const quest = QUESTS.find((entry) => entry.id === "courier");
    if (!quest) throw new Error("Missing courier quest");

    learnFact(progress, "courier-orders");
    learnFact(progress, "courier-memory");

    const choice = resolveQuest(progress, quest.id, "end");
    expect(choice).not.toBeNull();
    expect(choice?.reward).toBeUndefined();
    expect(progress.resolutions.courier).toBe("end");
    expect(canResolve(progress, quest)).toBe(false);
  });

  it("keeps rewards on the courier's two rewarded choices", () => {
    const bind: QuestProgress = { facts: ["courier-orders", "courier-memory"], resolutions: {} };
    expect(resolveQuest(bind, "courier", "bind")?.reward).toEqual({ stat: "blade", amount: 1 });

    const release: QuestProgress = { facts: ["courier-orders", "courier-memory"], resolutions: {} };
    expect(resolveQuest(release, "courier", "release")?.reward).toEqual({ stat: "health", amount: 2 });
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/quests.test.ts`
Expected: FAIL — `resolveQuest(progress, "courier", "end")` returns `null`
because no choice with id `end` exists yet.

- [ ] **Step 3: Make the reward optional**

In `src/game/quests.ts`, change the `choices` member of `QuestDefinition`
(line 13) so `reward` is optional:

```typescript
  choices: { id: string; label: string; text: string; reward?: { stat: "health" | "stamina" | "blade" | "dash"; amount: number } }[];
```

- [ ] **Step 4: Add the third courier choice**

In `src/game/quests.ts`, the courier quest's `choices` array gains a third
entry after `bind`. The rest of the courier's prose is rewritten in Task 8;
this text is already final, so Task 8 leaves it alone:

```typescript
      { id: "end", label: "End it. Take nothing.", text: "I did it outside, away from the hall, and Orithel did not stop me — he only noted that the yield was lost and asked me not to make a habit of it. It stopped being awake. That is the whole of what I accomplished, and I am not sorry." },
```

- [ ] **Step 5: Handle the absent reward in the engine**

`src/game/engine.ts:1106-1112` destructures `choice.reward` unconditionally
and will throw on a rewardless choice. Replace:

```typescript
    const p = this.player;
    const { stat, amount } = choice.reward;
    if (stat === "health") { p.maxHp += amount; p.hp = Math.min(p.maxHp, p.hp + amount); }
    if (stat === "stamina") { p.maxStamina += amount; p.stamina = p.maxStamina; }
    if (stat === "blade") p.attackBonus += amount;
    if (stat === "dash") p.dashCostDiscount += amount;
```

with:

```typescript
    const p = this.player;
    if (choice.reward) {
      const { stat, amount } = choice.reward;
      if (stat === "health") { p.maxHp += amount; p.hp = Math.min(p.maxHp, p.hp + amount); }
      if (stat === "stamina") { p.maxStamina += amount; p.stamina = p.maxStamina; }
      if (stat === "blade") p.attackBonus += amount;
      if (stat === "dash") p.dashCostDiscount += amount;
    }
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run src/game/quests.test.ts && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 7: Commit**

```bash
git add src/game/quests.ts src/game/quests.test.ts src/game/engine.ts
git commit -m "Allow rewardless quest choices and add the courier's third option

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Replace the win/lose binary with three endings

**Files:**
- Modify: `src/game/core/SceneStack.ts:1`
- Modify: `src/stores/useGameStore.ts:5,21-23,77-82`
- Modify: `src/game/types.ts:99-100`
- Modify: `src/components/GameCanvas.tsx:31-32`
- Modify: `src/game/engine.ts:713`, `:1221-1227`
- Modify: `src/App.tsx:98-99,145-146`
- Rewrite: `src/components/EndScreen.tsx`
- Test: `src/game/core/SceneStack.test.ts`, new `src/stores/useGameStore.test.ts`

**Interfaces:**
- Produces: `EndingId = "silence" | "refusal" | "spent"` exported from
  `src/game/core/SceneStack.ts`. `SceneId` loses `"win" | "lose"` and gains
  `"ending"`. Store exposes `endGame(ending: EndingId)`, state field
  `ending: EndingId | null`, and selector `selectEnding`.
  `GameCallbacks.onWin`/`onLose` collapse into `onEnd(ending: EndingId)`.
  `Game.endWin()` is renamed `Game.endRun(ending: EndingId)`.
- Consumes: nothing from Task 1.

- [ ] **Step 1: Write the failing tests**

Replace the whole of `src/game/core/SceneStack.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { SceneStack } from "./SceneStack";

describe("SceneStack", () => {
  it("keeps an overworld beneath a pause overlay", () => {
    const scenes = new SceneStack(["overworld"]);
    scenes.push("pause");

    expect(scenes.snapshot()).toEqual(["overworld", "pause"]);
    expect(scenes.top()).toBe("pause");
    scenes.pop();
    expect(scenes.top()).toBe("overworld");
  });

  it("replaces the world with a single ending scene", () => {
    const scenes = new SceneStack(["overworld"]);
    scenes.replace("ending");

    expect(scenes.snapshot()).toEqual(["ending"]);
    expect(scenes.has("overworld")).toBe(false);
  });
});
```

Create `src/stores/useGameStore.test.ts`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";
import { useGameStore } from "./useGameStore";

describe("ending state", () => {
  beforeEach(() => { useGameStore.getState().reset(); });

  it("records each ending and shows the ending scene", () => {
    for (const ending of ["silence", "refusal", "spent"] as const) {
      useGameStore.getState().startGame();
      useGameStore.getState().endGame(ending);

      const state = useGameStore.getState();
      expect(state.scenes).toEqual(["ending"]);
      expect(state.ending).toBe(ending);
      expect(state.dialogue).toBeNull();
    }
  });

  it("clears the previous ending when a new run starts", () => {
    useGameStore.getState().endGame("silence");
    useGameStore.getState().startGame();

    expect(useGameStore.getState().ending).toBeNull();
    expect(useGameStore.getState().scenes).toEqual(["overworld"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/game/core/SceneStack.test.ts src/stores/useGameStore.test.ts`
Expected: FAIL — `"ending"` is not a valid `SceneId`, and `state.ending`
does not exist.

- [ ] **Step 3: Update the scene union and add EndingId**

In `src/game/core/SceneStack.ts`, replace line 1 with:

```typescript
export type SceneId = "title" | "overworld" | "interior" | "menu" | "pause" | "cutscene" | "ending";

/** Which ending a finished run reached. `silence` is the old "win". */
export type EndingId = "silence" | "refusal" | "spent";
```

- [ ] **Step 4: Update the store**

In `src/stores/useGameStore.ts`:

Change the import on line 3 to:

```typescript
import { SceneStack, type SceneId, type EndingId } from "@/game/core/SceneStack";
```

In the `GameState` interface, add `ending: EndingId | null;` beneath
`journal: JournalEntry[];`, and change the `endGame` signature to:

```typescript
  endGame: (ending: EndingId) => void;
```

Add `ending: null,` to `initialState`, and add `"ending"` is not needed in
the `Omit<...>` list because `ending` is state, not an action — leave the
`Omit` unchanged.

Replace the `endGame` implementation (lines 77-82):

```typescript
  endGame: (ending: EndingId) => {
    set({
      scenes: ["ending"],
      ending,
      dialogue: null,
    });
  },
```

In `startGame`, add `ending: null,` to the object passed to `set`.

At the bottom of the file, beside `selectScreen`, add:

```typescript
export const selectEnding = (state: GameState) => state.ending;
```

- [ ] **Step 5: Update the callbacks type and the canvas**

In `src/game/types.ts`, replace lines 99-100 with:

```typescript
  onEnd: (ending: EndingId) => void;
```

and add to that file's imports:

```typescript
import type { EndingId } from "./core/SceneStack";
```

In `src/components/GameCanvas.tsx`, replace lines 31-32 with:

```typescript
      onEnd: (ending) => cbRef.current.onEnd(ending),
```

- [ ] **Step 6: Update the engine's two end sites**

In `src/game/engine.ts`, add `EndingId` to the existing
`./core/SceneStack` import if present, otherwise add:

```typescript
import type { EndingId } from "./core/SceneStack";
```

Replace `this.cb.onLose();` at line 713 with:

```typescript
          this.cb.onEnd("spent");
```

Replace the `endWin()` method (lines 1221-1227) with:

```typescript
  endRun(ending: EndingId) {
    if (this.ended) return;
    this.ended = true;
    if (ending === "silence") this.msg("The Unbound stops. All of it, at once.");
    this.cb.onEnd(ending);
  }
```

Then update the one caller of `endWin()` — find it with
`grep -n "endWin" src/game/engine.ts` — and change it to
`this.endRun("silence")`.

- [ ] **Step 7: Rewrite EndScreen**

Replace the whole of `src/components/EndScreen.tsx`. The `silence` and
`spent` titles and buttons are verbatim from the current file — that is
deliberate, do not improve them:

```tsx
import { useEffect } from "react";
import endingBg from "@/assets/ending.jpg";
import type { EndingId } from "@/game/core/SceneStack";

interface EndingCopy {
  title: string;
  body: string;
  button: string;
  image: string;
  scrim: string;
  heading: string;
  action: string;
}

const ENDINGS: Record<EndingId, EndingCopy> = {
  silence: {
    title: "THE SPIRE FALLS SILENT",
    body: "Nine hundred years of people stop at once. It is the largest thing you will ever do and it takes less time than a breath. The shards scatter into the dawn like fireflies, exactly the way the old songs promised, and Eldrinth stirs beneath a sun it had forgotten. Behind you, in the quiet, something finishes assembling itself and walks out of the Spire wearing your face. It thanks you. It means that, too.",
    button: "WALK AGAIN",
    image: "opacity-80",
    scrim: "bg-linear-to-b from-amber-950/30 via-black/30 to-black/80",
    heading: "text-amber-50",
    action: "border-amber-300/50 bg-amber-400/10 text-amber-50 hover:bg-amber-400/20",
  },
  refusal: {
    title: "THE SPIRE HEARS YOU",
    body: "You say no. Orithel does not argue — he has no procedure for it, and you watch him reach for one and find the shelf empty. Nine hundred years of screaming stops, all at once, to listen. Something enormous turns its attention on the two of you and begins, very slowly, to work out what it is being offered. Whatever happens next has no word for it yet. It is not rescue. It is not over.",
    button: "STAY",
    image: "opacity-40 contrast-125",
    scrim: "bg-linear-to-b from-slate-950/60 via-slate-900/50 to-black/85",
    heading: "text-teal-100",
    action: "border-teal-200/50 bg-teal-300/10 text-teal-50 hover:bg-teal-300/20",
  },
  spent: {
    title: "YOUR LIGHT FADES",
    body: "You do not die. The Sundered close over you and the old light gutters out, and then there is a long nothing, and then a pattern is drawn again from a courier's recovered shape and stood up on the road east of Ilyarael, knowing nothing, certain it has never come this way before. Count the entries in this slot. That is how many times.",
    button: "RISE AGAIN",
    image: "opacity-25 grayscale",
    scrim: "bg-black/85",
    heading: "text-rose-200",
    action: "border-rose-300/50 bg-rose-400/10 text-rose-50 hover:bg-rose-400/20",
  },
};

export default function EndScreen({
  ending,
  onRestart,
}: {
  ending: EndingId;
  onRestart: () => void;
}) {
  const copy = ENDINGS[ending];
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onRestart();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onRestart]);
  return (
    <div className="absolute inset-0 z-40 flex flex-col items-center justify-center overflow-hidden">
      <img src={endingBg} alt="" className={`absolute inset-0 h-full w-full object-cover ${copy.image}`} />
      <div className={`absolute inset-0 ${copy.scrim}`} />
      <div className="absolute inset-0 vignette" />

      <div className="relative z-10 flex max-w-2xl flex-col items-center px-6 text-center">
        <h1
          className={`font-title text-5xl font-bold tracking-[0.15em] drop-shadow-[0_2px_18px_rgba(0,0,0,0.9)] sm:text-6xl ${copy.heading}`}
        >
          {copy.title}
        </h1>

        <p className="mt-6 max-w-xl font-serif text-base leading-relaxed text-amber-50/75 sm:text-lg">
          {copy.body}
        </p>

        <button
          onClick={onRestart}
          className={`mt-9 rounded-lg border px-10 py-4 font-title text-lg tracking-[0.3em] transition hover:scale-[1.03] ${copy.action}`}
        >
          {copy.button}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 8: Update App.tsx**

In `src/App.tsx`, add `selectEnding` to the `@/stores` import and read it:

```tsx
  const ending = useGameStore(selectEnding);
```

Replace the two callbacks at lines 98-99 with:

```tsx
    onEnd: (result) => { setCheckpoint(null); endGame(result); },
```

Replace the two render lines at 145-146 with:

```tsx
      {screen === "ending" && ending && <EndScreen ending={ending} onRestart={restart} />}
```

- [ ] **Step 9: Run the full suite and type-check**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all tests pass (102 existing + the new ones), no type errors.

- [ ] **Step 10: Commit**

```bash
git add src/game/core/SceneStack.ts src/game/core/SceneStack.test.ts src/stores/useGameStore.ts src/stores/useGameStore.test.ts src/game/types.ts src/components/GameCanvas.tsx src/components/EndScreen.tsx src/game/engine.ts src/App.tsx
git commit -m "Replace the win/lose ending binary with three endings

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: The refusal dialogue gate at the ward

Today `engine.ts:775-778` spawns the boss the instant a player with
`wardUnlocked` comes within `TILE * 5` of `map.bossCenter`. It becomes a
dialogue with two choices. The dialogue must be re-openable — if the player
walks away and comes back, they get it again, or the ward becomes a dead end.

**Files:**
- Modify: `src/game/engine.ts:775-778` (the proximity trigger), `:1069+` (`chooseDialogue`)

**Interfaces:**
- Consumes: `Game.endRun(ending: EndingId)` from Task 2.
- Produces: dialogue choice ids `ending:surrender` and `ending:refuse`,
  handled in `chooseDialogue` before its `quest:` branch.

- [ ] **Step 1: Add the ward dialogue text**

Near `ORITHEL_LINES` in `src/game/engine.ts` (after line 128), add:

```typescript
const WARD_LINES = [
  "There you are. Nine. You have no idea how rarely it runs this cleanly, and I would like you to hear me say so.",
  "I will take them now. The Unbound has been very loud for a very long time, and it will be a kindness to everyone — itself most of all — when it stops.",
  "You have been extraordinary. I want you to understand that I mean that. I have said it before, and I have always meant it.",
];
```

- [ ] **Step 2: Replace the boss proximity trigger**

Replace lines 775-778 of `src/game/engine.ts`:

```typescript
    if (this.world.regionId === "overworld" && !this.changingRegion && !this.bossSpawned && this.wardUnlocked) {
      if (Math.hypot(p.x - this.map.bossCenter.x, p.y - this.map.bossCenter.y) < TILE * 5)
        this.spawnBoss();
    }
```

with:

```typescript
    if (this.world.regionId === "overworld" && !this.changingRegion && !this.bossSpawned && this.wardUnlocked && !this.dialogue && !this.ended) {
      if (Math.hypot(p.x - this.map.bossCenter.x, p.y - this.map.bossCenter.y) < TILE * 5)
        this.openWardChoice();
    }
```

Because the guard is `!this.bossSpawned`, walking away and returning reopens
the dialogue — nothing is consumed until a choice is made.

- [ ] **Step 3: Add the dialogue opener**

Add this method to `Game`, next to `openWatcherTopics`:

```typescript
  private openWardChoice() {
    this.openDialogue(WARD_LINES.slice(), "Orithel, the Architect", "#9ff7e6");
    this.dialogue!.choices = [
      { id: "ending:surrender", label: "Give him the nine." },
      { id: "ending:refuse", label: "No." },
    ];
    this.cb.onDialogue({ ...this.dialogue! });
  }
```

The speaker is `"Orithel, the Architect"` — the first and only place the
game names him that.

- [ ] **Step 4: Handle the two choices**

In `chooseDialogue`, immediately after the `if (id === "topics")` line and
before the `if (id === "spire")` block, add:

```typescript
    if (id === "ending:surrender") {
      this.dialogue = null;
      this.cb.onDialogue(null);
      this.spawnBoss();
      return;
    }
    if (id === "ending:refuse") {
      this.dialogue = null;
      this.cb.onDialogue(null);
      this.endRun("refusal");
      return;
    }
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/game/engine.ts
git commit -m "Gate the Spire behind Orithel's collection, with a refusal

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Content warning screen

Required at this rating. Shown once before the title screen; dismissal
persists in `localStorage` and does not gate replays.

**Files:**
- Create: `src/components/ContentWarning.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Produces: `ContentWarning` default export taking `{ onAcknowledge: () => void }`.
  `localStorage` key `eldrinth:content-warning:v1`.
- Consumes: nothing.

- [ ] **Step 1: Create the component**

Create `src/components/ContentWarning.tsx`:

```tsx
import { useEffect } from "react";

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
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onAcknowledge();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onAcknowledge]);

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black px-6">
      <div className="max-w-xl text-center">
        <h1 className="font-title text-2xl tracking-[0.3em] text-rose-200/90">BEFORE YOU BEGIN</h1>
        <p className="mt-8 font-serif text-base leading-relaxed text-amber-50/70">
          Eldrinth is a story about people who built a machine out of other people and
          then wrote it down neatly. It contains institutional violence, the killing of
          children, and one reference to sexual violence recorded as an administrative
          permission.
        </p>
        <p className="mt-4 font-serif text-base leading-relaxed text-amber-50/70">
          None of it is here to be enjoyed. None of it is softened either.
        </p>
        <button
          onClick={onAcknowledge}
          className="mt-10 rounded-lg border border-rose-300/40 bg-rose-400/10 px-10 py-4 font-title text-base tracking-[0.3em] text-rose-50 transition hover:bg-rose-400/20"
        >
          I UNDERSTAND
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire it into App**

In `src/App.tsx`, add the import:

```tsx
import ContentWarning, { contentWarningSeen, markContentWarningSeen } from "@/components/ContentWarning";
```

Add state beside the other `useState` calls:

```tsx
  const [warned, setWarned] = useState(() => contentWarningSeen());
```

Add the acknowledge handler beside the other callbacks:

```tsx
  const acknowledgeWarning = useCallback(() => {
    markContentWarningSeen();
    setWarned(true);
  }, []);
```

Render it as the first child inside the root `<div>`, and gate the title
screen on it. Replace the title-screen line:

```tsx
      {screen === "title" && !introPlaying && <TitleScreen onStart={start} onContinue={resume} onErase={eraseSlot} slots={slots} />}
```

with:

```tsx
      {!warned && <ContentWarning onAcknowledge={acknowledgeWarning} />}
      {warned && screen === "title" && !introPlaying && <TitleScreen onStart={start} onContinue={resume} onErase={eraseSlot} slots={slots} />}
```

Leaving `TitleScreen` unmounted until acknowledgement matters: it binds a
global Enter handler that would otherwise start a run on the same keypress
that dismisses this notice.

- [ ] **Step 3: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/ContentWarning.tsx src/App.tsx
git commit -m "Add a first-launch content warning

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Escalating shard messages and journal bleed

Implements the §6 escalation: shard pickup stops being triumphant, and from
the sixth shard the journal starts recording entries in the courier's voice
that the player did not write.

**Files:**
- Create: `src/game/escalation.ts`
- Modify: `src/game/engine.ts:875-883`
- Test: new `src/game/escalation.test.ts`

**Interfaces:**
- Produces: `shardPickupMessage(count: number, total: number): string` and
  `shardBleedEntry(count: number): JournalEntry | null`, both exported from
  the new `src/game/escalation.ts`.
- Consumes: `JournalEntry` from `src/game/types.ts`.

These live in their own module rather than in `engine.ts` on purpose. No
test in this repo imports `engine.ts` — it pulls in `renderer.ts` and the
whole sprite-atlas layer, which expects a browser. Two pure string
functions in a leaf module stay trivially testable in Node.

- [ ] **Step 1: Write the failing test**

Create `src/game/escalation.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { shardBleedEntry, shardPickupMessage } from "./escalation";

describe("shard escalation", () => {
  it("reports a plain count for the early shards", () => {
    expect(shardPickupMessage(1, 9)).toBe("Anima Shard recovered (1/9).");
    expect(shardPickupMessage(2, 9)).toBe("Anima Shard recovered (2/9).");
  });

  it("darkens once the player is deep enough to notice", () => {
    expect(shardPickupMessage(6, 9)).toContain("still talking");
    expect(shardPickupMessage(8, 9)).toContain("done this before");
  });

  it("always names the running count", () => {
    for (let n = 1; n <= 9; n++) expect(shardPickupMessage(n, 9)).toContain(`(${n}/9)`);
  });

  it("writes nothing in the player's hand before the sixth", () => {
    for (let n = 1; n <= 5; n++) expect(shardBleedEntry(n)).toBeNull();
  });

  it("bleeds the courier's voice into the journal from the sixth", () => {
    for (const n of [6, 7, 8]) {
      const entry = shardBleedEntry(n);
      expect(entry).not.toBeNull();
      expect(entry?.id).toBe(`bleed:${n}`);
      expect(entry?.source).toBe("My own hand");
    }
    expect(shardBleedEntry(8)?.text).toContain("Do not surrender it");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/escalation.test.ts`
Expected: FAIL — `src/game/escalation.ts` does not exist.

- [ ] **Step 3: Implement both functions**

Create `src/game/escalation.ts`:

```typescript
import type { JournalEntry } from "./types";

/** The count stays legible at every step; only the sentence after it changes. */
const SHARD_NOTES: Record<number, string> = {
  3: " It was warm.",
  4: " Something let go of it.",
  5: " I did not ask what it had been.",
  6: " It was still talking when I closed my hand.",
  7: " I have stopped listening on purpose.",
  8: " One left. I have done this before.",
};

export function shardPickupMessage(count: number, total: number): string {
  return `Anima Shard recovered (${count}/${total}).${SHARD_NOTES[count] ?? ""}`;
}

/** Entries the player did not write, in the courier's hand, from the sixth shard on. */
const SHARD_BLEED: Record<number, string> = {
  6: "I have read this four times looking for the part where it is something other than what it is. It isn't there. It was never going to be there.",
  7: "It has a child's voice.",
  8: "Do not surrender it. Do not surrender it. Do not surrender it.",
};

export function shardBleedEntry(count: number): JournalEntry | null {
  const text = SHARD_BLEED[count];
  if (!text) return null;
  return { id: `bleed:${count}`, title: "My observations", text, source: "My own hand" };
}
```

If `JournalEntry` requires fields beyond these four, add them here to match
its declaration in `src/game/types.ts` rather than loosening the return type.

- [ ] **Step 4: Use them at the pickup site**

Add the import at the top of `src/game/engine.ts`:

```typescript
import { shardBleedEntry, shardPickupMessage } from "./escalation";
```

Then replace the ward/pickup block at lines 875-883:

```typescript
          if (this.shards >= this.totalShards) {
            this.wardUnlocked = true;
            this.syncMovementSystem();
            this.msg("The ward before the Spire falters. The way opens.");
            this.burst(it.x, it.y, "#46f0d8", 30);
            this.ring(this.map.bossCenter.x, this.map.bossCenter.y, "#46f0d8");
          } else {
            this.msg(`Anima Shard recovered (${this.shards}/${this.totalShards}).`);
          }
```

with:

```typescript
          const bleed = shardBleedEntry(this.shards);
          if (bleed && !this.world.journal.some((entry) => entry.id === bleed.id)) {
            this.world.journal.push(bleed);
            this.publishJournal();
          }
          if (this.shards >= this.totalShards) {
            this.wardUnlocked = true;
            this.syncMovementSystem();
            this.msg("The ward gives. Nine. It was always going to be nine, and now I know who picked the number.");
            this.burst(it.x, it.y, "#46f0d8", 30);
            this.ring(this.map.bossCenter.x, this.map.bossCenter.y, "#46f0d8");
          } else {
            this.msg(shardPickupMessage(this.shards, this.totalShards));
          }
```

The `some(...)` guard keeps a reloaded save from duplicating an entry.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/game/escalation.ts src/game/escalation.test.ts src/game/engine.ts
git commit -m "Escalate shard pickups and bleed the courier into the journal

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Rewrite the intro sequence

**Files:**
- Modify: `src/components/IntroSequence.tsx:6` (`MEMORY_WORDS`), `:89-118` (shots 1-3)

**Interfaces:** none — copy only.

**Do not touch shot 0, shot 4, or shot 5.** Shot 4 is already correct for
the new canon and shot 5 is the title card.

- [ ] **Step 1: Replace MEMORY_WORDS**

Line 6 becomes the vocabulary of the intake rather than of a life:

```typescript
const MEMORY_WORDS = ["INTAKE", "YIELD", "ROLLS", "UNITS", "WASTAGE", "PERMITTED"];
```

- [ ] **Step 2: Rewrite shot 1**

Replace the shot 1 block (the `THE KINDNESS` chapter). The index label is
kept — it is the Architects' own word for it, and that is the joke:

```tsx
        {shot === 1 && (
          <div className="intro-chapter intro-chapter-left">
            <div className="intro-index">I &nbsp; / &nbsp; THE KINDNESS</div>
            <p>The Elder Elves set out to build a mind</p>
            <p className="intro-line-delay-1">that would lose nothing.</p>
            <p className="intro-line-delay-2 intro-accent">A mind cannot be built. Only taken.</p>
          </div>
        )}
```

- [ ] **Step 3: Rewrite shot 2**

Replace the shot 2 block. The index becomes `THE PROGRAM`:

```tsx
        {shot === 2 && (
          <div className="intro-chapter intro-chapter-center">
            <div className="intro-index">II &nbsp; / &nbsp; THE PROGRAM</div>
            <div className="intro-memory-words" aria-hidden="true">
              {MEMORY_WORDS.map((word, index) => (
                <span key={word} style={{ "--memory-index": index } as React.CSSProperties}>{word}</span>
              ))}
            </div>
            <p>They began with prisoners. Then the poor.</p>
            <p className="intro-line-delay-2 intro-accent">Then, when those ran out, their own children.</p>
          </div>
        )}
```

- [ ] **Step 4: Rewrite shot 3**

Replace the shot 3 block. The `intro-alone` class is kept so the existing
CSS animation still applies:

```tsx
        {shot === 3 && (
          <div className="intro-chapter intro-chapter-right">
            <div className="intro-index">III &nbsp; / &nbsp; THE SILENCE</div>
            <p>When the last Elf died,</p>
            <p className="intro-line-delay-1">the mind went on remembering</p>
            <p className="intro-line-delay-2">every death it had been made of.</p>
            <strong className="intro-alone">AWAKE.</strong>
          </div>
        )}
```

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all pass.

- [ ] **Step 6: Commit**

```bash
git add src/components/IntroSequence.tsx
git commit -m "Rewrite the intro: the Engine was made out of people

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Rewrite Orithel's lines

Register 2.1 throughout. He is warm, helpful, and never swears. The lines
must still function as the game's directions — they are the only place the
shard distribution is stated.

**Files:**
- Modify: `src/game/engine.ts:119-128` (`ORITHEL_LINES`), `:1060` (`openWatcherTopics`), `:1192` (wayfire rest)

**Interfaces:** none — copy only. `ORITHEL_LINES` must stay at 8 entries;
`chooseDialogue`'s `spire` branch journals `ORITHEL_LINES.slice(3, 7)`.

- [ ] **Step 1: Replace ORITHEL_LINES**

```typescript
const ORITHEL_LINES = [
  "You wear the old marks upon your blade. Are you of the Line of Elun? No matter — the living are rare here, and I have learned not to ask twice.",
  "I am Orithel. A Mnemonic: a mind the Elder Elves drew out of living light and set to watch over Ilyarael, when they could no longer watch it themselves.",
  "We were shepherds once. When the Elves passed into dust a great many of my kin lost their purpose and Sundered into hunger. You will have met them on the roads by now.",
  "The greatest of the Sundered — the Unbound — wakes beneath the Glass Spire, and it is drinking the light of this world a swallow at a time.",
  "The first Spire is a husk. The Unbound withdrew east past Moonfall Reach and braided a new ward from nine Anima Shards. Nine exactly. A tidy number, and it was settled on long before either of us arrived.",
  "Three shards lie in the Old Lands. Two in the Cinderwild, two on Moonlit Coast, two in the Starfall Moors. Read the markers in the southern ash country and they will give you the frontier roads.",
  "Do not rush the final gate. Walk the ruins, let each shard answer your blade, and bring the yield back to me. I will keep it safe until the ninth.",
  "Go, wayfarer. The old light has been very patient. So have I.",
];
```

- [ ] **Step 2: Rewrite the hub greeting**

At `src/game/engine.ts:1060`, replace the two greeting strings inside
`openWatcherTopics`:

```typescript
    this.openDialogue([resolved ? `You have brought ${resolved === 1 ? "one account" : `${resolved} accounts`} back into this hall, and the record is the better for it. What else should we settle?` : "The roads keep better records than I do. Ask about whatever troubles you, bring back what you find, and we will decide together what it meant."], "Orithel, the Last Watcher", "#9ff7e6");
```

- [ ] **Step 3: Rewrite the wayfire rest text**

At `src/game/engine.ts:1192`, replace:

```typescript
      this.openDialogue([`The flames recognize you. ${reward}.`, "This wayfire is now your refuge. Death will return you here, and resting restores your strength."], fire.name, "#ffd28a");
```

with:

```typescript
      this.openDialogue([`The flames recognise you and read you over, the way a clerk reads a docket. ${reward}.`, "This wayfire is your refuge now. Death returns you here, resting restores your strength, and everything you are carrying is noted down somewhere you cannot see."], fire.name, "#ffd28a");
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all pass.

- [ ] **Step 5: Commit**

```bash
git add src/game/engine.ts
git commit -m "Rewrite Orithel in the administrative register

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Rewrite the three investigations

**Files:**
- Modify: `src/game/quests.ts:16-53` (the `QUESTS` array)

**Interfaces:** none — copy only. Fact IDs, choice IDs, and reward
stat/amount pairs are unchanged. The `end` choice added in Task 1 keeps the
text it was given there.

- [ ] **Step 1: Rewrite the courier quest**

Replace the `courier` entry's `lead`, `evidence`, and the `release`/`bind`
choice texts (leave `end` exactly as Task 1 wrote it):

```typescript
    id: "courier", title: "The Courier Who Never Came",
    lead: "A courier of mine went east with a sealed vessel and did not come back. A copy of her orders is still in Ilyarael, against the south wall, east of the Watcher. Her destination was the Cinderwild — from the central stone circle, the road northeast, to the broken shrine. I would like to know where the vessel went. And her, of course.",
    evidence: [
      { fact: "courier-orders", title: "Orders beneath the dust", text: "The orders are routine. Carry the vessel to the shrine, surrender it to the collector, do not open it, do not listen to it. Beneath the seal, in a different hand, pressed hard enough to tear the paper: ‘It has a child's voice. I have read this four times looking for the part where this is something other than what it fucking is. It isn't there. It was never going to be there.’" },
      { fact: "courier-memory", title: "The courier's last stand", text: "She never delivered it. She got as far as the shrine and could not make herself finish, so she spent herself sheltering it instead — nine hundred years of her, keeping one vessel warm. The child is still inside. Still awake. It has been awake the entire time, and it would like to know whether it is going to be allowed to stop." },
    ],
```

```typescript
      { id: "release", label: "Give the child to the wayfires. (+2 health)", text: "Orithel opens the vessel with enormous gentleness. Something small says thank you, because nobody has ever explained to it what the wayfires are for. The warmth that reaches me afterward is not mine and I can feel exactly whose it is. Maximum health +2.", reward: { stat: "health", amount: 2 } },
      { id: "bind", label: "Bind the child to my blade. (+1 damage)", text: "Orithel folds it into the edge of my weapon and observes that the work will be over sooner this way, which is true. The blade cuts deeper now. It does not make any sound at all. I keep checking. Blade damage +1.", reward: { stat: "blade", amount: 1 } },
```

- [ ] **Step 2: Rewrite the salt quest**

```typescript
    id: "salt", title: "Names the Tide Kept",
    lead: "A keeper on the coast struck a great many names off his rolls, and I would like them back. Two accounts survive. Take the south road from the Old Lands to Moonlit Coast; at the pale circle one track runs southwest to the salt graves, another northeast to the beacon. Read both before you decide anything. People judge the man too quickly.",
    evidence: [
      { fact: "salt-graves", title: "The salt graves", text: "No bodies. Only names, scraped down to the stone. The evacuation ledger says the last boat left half empty, and every passenger who did not board carries the same mark in the margin — the intake mark, though the ledger does not call it that. RECONCILED — 41. TRANSFERRED TO COLLECTION — 39. And underneath, in the same clerk's unhurried hand, a note that the remainder, being already struck from the rolls, were not counted out, and that whatever the collectors did with them on the road was not a matter the harbour was obliged to record, a person who does not exist being incapable of complaint." },
      { fact: "salt-beacon", title: "The keeper's confession", text: "His own account, signed on every page. ‘I chose. Someone had to choose and I was the one standing there. Forty went on that boat who would not have gone otherwise. I know exactly what that cost and I have never once pretended the arithmetic was clean.’ He is reasonable for eleven pages. Reasonable about the price, about the necessity, about the families. By the ninth page I had started nodding along, and that frightened me worse than the graves did." },
    ],
```

```typescript
      { id: "remember", label: "Restore the rolls. (+25 stamina)", text: "Orithel puts every name back where it was taken from, and the coast learns precisely what was done and precisely how far beyond any reach the man who did it has been for nine hundred years. Knowing is not redress. They will have to make do with it, the way I do. Maximum stamina +25.", reward: { stat: "stamina", amount: 25 } },
      { id: "mercy", label: "Let the rolls stay quiet. (Dash cost −5)", text: "We seal the account in Ilyarael. The keeper's arithmetic holds, the families keep a gentler arithmetic of their own, and I come away with the small trick he used — how to step out of a record, how to be somewhere and leave nothing behind that anyone could count. Dash stamina cost −5, to a minimum of 10.", reward: { stat: "dash", amount: 5 } },
```

- [ ] **Step 3: Rewrite the dawn quest**

```typescript
    id: "dawn", title: "A Borrowed Dawn",
    lead: "There is a fallen observatory northwest of the Moors' central wayfire, and its lens is of considerable interest to me. The Starfall Moors can be reached by the southeastern Cinderwild road or the eastern coastal road. The astronomer who built the thing is still operating, after a fashion, at the end of the eastern track — you will know the shell when it attacks you. Read the record first. I would rather you understood the apparatus before you broke it.",
    evidence: [
      { fact: "dawn-record", title: "The observatory's promise", text: "‘One dawn, forever’ is what the plaque says, and what the funding said. The working notes say something else. The lens was an intake prototype and he tested it on himself, deliberately, to demonstrate that the process was survivable at scale. He wrote down the moment he understood that it was not. He kept writing for a considerable time after that." },
      { fact: "warden:starfall-moors", title: "The astronomer's last watch", text: "The shell is open. He is still in it, and has been for nine hundred years, walking the eastern road and killing everyone who walked it while entirely aware of doing so. He thanks me. Then he asks whether the program went ahead anyway. I have no way to answer him, and Orithel has not offered me one." },
    ],
```

```typescript
      { id: "kindle", label: "Kindle the dawn within me. (+3 health)", text: "Orithel sets what is left of the astronomer burning in my chest, where it will keep me upright a while longer. This is the second time his body has been used to demonstrate something. Maximum health +3.", reward: { stat: "health", amount: 3 } },
      { id: "temper", label: "Temper the dawn into my blade. (+1 damage)", text: "Orithel folds him into the edge of my blade and remarks that the man would have appreciated the efficiency. He is probably right about that. It is not a defence. Blade damage +1.", reward: { stat: "blade", amount: 1 } },
```

- [ ] **Step 4: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. `quests.test.ts` still passes — reward pairs are
unchanged.

- [ ] **Step 5: Commit**

```bash
git add src/game/quests.ts
git commit -m "Give the three investigations teeth

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Rewrite the world text

Every sign, survey, and record. This is the largest prose task; the
salt-graves ledger here carries the §7.3 line and must match the wording
used in Task 8's `salt-graves` evidence.

**Files:**
- Modify: `src/game/map.ts:236-257` (Old Lands signs), `:358` (frontier road signs), `:361-364` (surveys), `:366-378` (records)

**Interfaces:** none — copy only. Every `x`/`y`/`title`/`fact` field stays
exactly as it is; only `text` changes, except where a title is given below.

- [ ] **Step 1: Rewrite the Old Lands signs**

Replace the `text` of each entry in the `signs` array at `map.ts:236-257`,
in order:

```typescript
      text: "MOVE  WASD / Arrows · ATTACK  J / Space · DASH  Shift · SPEAK / READ  E · JOURNAL  L · PAUSE  Esc. The Watcher keeps the hall in Ilyarael: this road east to the junction, then south past the wayfire into the ruin. Write down what you find. Nobody else is going to.",
```

```typescript
      text: "Here stood Ilyarael. Orithel keeps the hall through this northern doorway. A scout left three sightings before she stopped reporting: north along the western forest track; north of the mountain pass beyond the lake; and east of this approach, beneath an adept's watch.",
```

```typescript
    { x: 35, y: 41, title: "The Courier's Orders", fact: "courier-orders", text: "Deliver the vessel to the collector at the broken shrine northeast of the Cinderwild's central circle. Do not open it. Do not listen to it. Beneath the seal, in a hand that tore the paper: ‘It has a child's voice. I have read this four times looking for the part where this is something other than what it fucking is. It isn't there. It was never going to be there.’" },
    { x: 44, y: 13, title: "The Spire Warning", text: "Beyond the black ridge stands a glass tower. The old moon-road crosses the lake and keeps east. Those who followed it came back describing a sleeping thing. The ones who stayed and listened longer came back describing a crowd." },
    { x: 52, y: 16, title: "A Pilgrim's Correction", text: "The first Spire is empty. Its keeper went east past the old ward. The pale-stone road is surest; the southern ash road has fewer eyes on it, if that matters to you. It mattered to me." },
    { x: 64, y: 54, title: "Charred Surveyor's Page", text: "No fragments remain in the ash country — collected long ago, the ledger says, though it does not say by whom or on whose authority. At this junction the south road reaches Moonlit Coast; east past Moonfall Crossing lies the Cinderwild. Each frontier holds two. Both roads run on to the Starfall Moors, where the last pair went." },
    { x: 78, y: 55, title: "Moonfall Crossing", text: "East into the Cinderwild. North back toward the Spire. Nine fragments answer the ward: three in the Old Lands, two in each frontier — Cinderwild, Moonlit Coast, Starfall Moors. Nine is not a natural number for a ward. Somebody asked for nine." },
    { x: 76, y: 22, title: "Offering Ledger", text: "Before entering Moonfall Reach, travellers left offerings at the fork north of the ash road. The last party took the eastern path. The ledger records their offering and their names, and then a second entry striking the names out, in a different hand, dated the same day." },
    { x: 79, y: 14, title: "The Last Ward", text: "Nine Anima Shards shall quiet the dreamer. No fewer. The ward does not point the way. It only remembers what was taken, which is the one thing everybody involved would rather it did not do." },
    { x: 96, y: 56, title: "East Road Marker", text: "The Cinderwild lies east: ash storms, broken shrines, no easy return. A tall stone circle at its heart, if the scouts were being honest." },
    { x: 62, y: 69, title: "South Road Marker", text: "Moonlit Coast lies south. Follow the salt wind to lands the old maps forgot, or were made to forget. A pale beacon burns where its roads meet." },
```

- [ ] **Step 2: Rewrite the frontier road sign template**

At `map.ts:358`, replace the template literal:

```typescript
  const signs: SignData[] = config.exits.map((exit) => ({ x: exit.x, y: exit.y, title: "Road of Wayfarers", text: `The road leads toward ${exit.label}. Old wheel-ruts, mostly. They run deeper going east than coming back, which tells you what the traffic was and which direction it was carrying.` }));
```

- [ ] **Step 3: Rewrite the three surveys**

Replace the `surveys` record at `map.ts:361-364`:

```typescript
  const surveys: Record<string, string> = {
    cinderwild: "This is the Cinder Circle. The northeast track ends at a broken shrine — a fragment there, and a vessel that was never delivered. The southeast track ends at a ruined watchpost, where a warden still holds a second fragment and has forgotten why it is holding anything. The long road southeast reaches the Starfall Moors.",
    "moonlit-coast": "At this pale circle: southwest to the salt graves and a fragment; northeast to the keeper's beacon, where a warden watches the second. The graves are the older road and much the better lit, which is not an accident. The eastern road reaches the Starfall Moors.",
    "starfall-moors": "The fallen observatory lies northwest of this wayfire, inside the stone ring; a fragment sits among its records. The road east, sloping slightly south, ends at the astronomer's guardian and the last fragment. The northwest road returns to the Cinderwild, the southwest to Moonlit Coast.",
  };
```

- [ ] **Step 4: Rewrite the six region records**

Replace the `records` record at `map.ts:366-378`:

```typescript
  const records: Record<string, SignData[]> = {
    cinderwild: [
      { x: 72, y: 20, title: "The Broken Shrine", fact: "courier-memory", text: "A courier's shell, curled around a vessel the size of a fist. She got this far and could not finish, so she spent herself keeping it warm instead — nine hundred years of her, for this. The thing inside is still awake. It has been awake the entire time. It asks, very politely, whether it is going to be allowed to stop. I copy every word into my journal because I do not trust myself to carry it accurately." },
      { x: 84, y: 53, title: "The Ruined Watchpost", text: "The southern watch fell defending a fragment, and the warden still walks its circuit around an empty post. It does not know the post is empty. Beyond these fields the southeastern road descends into the Starfall Moors." },
    ],
    "moonlit-coast": [
      { x: 24, y: 48, title: "The Salt Graves", fact: "salt-graves", text: "No bodies. Only names, scraped down to the stone. The evacuation ledger says the last boat left half empty, and every passenger who did not board carries the same mark in the margin — the intake mark, though the ledger does not call it that. RECONCILED — 41. TRANSFERRED TO COLLECTION — 39. And underneath, in the same clerk's unhurried hand, a note that the remainder, being already struck from the rolls, were not counted out, and that whatever the collectors did with them on the road was not a matter the harbour was obliged to record, a person who does not exist being incapable of complaint. Another account survives at the beacon northeast of the pale circle." },
      { x: 78, y: 18, title: "The Keeper's Beacon", fact: "salt-beacon", text: "‘I chose. Someone had to choose and I was the one standing there. Forty went on that boat who would not have gone otherwise. I know exactly what that cost and I have never once pretended the arithmetic was clean.’ He is reasonable for eleven pages, and signed every one of them. By the ninth I had started nodding along, and that frightened me worse than the graves did. Orithel would know what to do with this." },
    ],
    "starfall-moors": [
      { x: 47, y: 35, title: "The Fallen Observatory", fact: "dawn-record", text: "‘One dawn, forever’ is what the plaque says, and what the funding said. The working notes say something else. The lens was an intake prototype and he tested it on himself, deliberately, to demonstrate the process was survivable at scale. He wrote down the moment he understood that it was not. He kept writing for a considerable time after. His guardian waits at the end of the eastern track, just south of east from the wayfire." },
      { x: 78, y: 42, title: "The Astronomer's Watch", text: "The guardian's casing carries the observatory seal, stamped into the metal the way equipment is stamped. Something is burning inside it and has not been permitted to stop burning. It will not leave the road while the shell holds." },
    ],
  };
```

- [ ] **Step 5: Verify**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass. `map.test.ts` and `regions.test.ts` assert geometry and
are unaffected by copy.

- [ ] **Step 6: Commit**

```bash
git add src/game/map.ts
git commit -m "Rewrite the world text: the record is bureaucratic

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Rewrite HUD objectives

Register 2.4 — the player's own voice, on screen constantly, so it stays
short and still tells them what to do.

**Files:**
- Modify: `src/game/systems/GameFlowSystem.ts:29-35`
- Modify: `src/stores/useGameStore.ts` (`initialHud.objective`)
- Test: `src/game/systems/GameFlowSystem.test.ts`

**Interfaces:** none — copy only. `currentObjective` keeps its signature.

- [ ] **Step 1: Write the failing test**

Add to `src/game/systems/GameFlowSystem.test.ts`:

```typescript
describe("GameFlowSystem objectives", () => {
  const base = {
    player: { x: 0, y: 0, hp: 6, maxHp: 6, stamina: 100, maxStamina: 100, r: 11 },
    enemies: [],
    boss: null,
    shards: 0,
    totalShards: 9,
    wardUnlocked: false,
    bossSpawned: false,
    message: "",
    messageId: 0,
    prompt: "",
    dialogue: null,
    map: { regionName: "Test", npc: { x: 0, y: 0 }, signs: [], campfires: [] },
    items: [],
  };

  it("asks the player to record what was taken while shards remain", () => {
    const flow = new GameFlowSystem();
    expect(flow.currentObjective(base)).toBe("Read the roads. Record what was taken.");
  });

  it("names Orithel once the ward is open", () => {
    const flow = new GameFlowSystem();
    expect(flow.currentObjective({ ...base, shards: 9, wardUnlocked: true })).toContain("Orithel");
  });

  it("describes the Unbound as a crowd during the fight", () => {
    const flow = new GameFlowSystem();
    const state = { ...base, shards: 9, wardUnlocked: true, bossSpawned: true, boss: { alive: true, hp: 40, maxHp: 40 } };
    expect(flow.currentObjective(state)).toContain("screaming");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/game/systems/GameFlowSystem.test.ts`
Expected: FAIL on the old strings.

- [ ] **Step 3: Rewrite the objectives**

Replace `currentObjective`'s body in
`src/game/systems/GameFlowSystem.ts:29-35`:

```typescript
  currentObjective(state: GameFlowState): string {
    if (state.shards < state.totalShards) {
      return "Read the roads. Record what was taken.";
    }
    if (!state.wardUnlocked) return "Something in the east stops pretending";
    if (!state.bossSpawned) return "The ward is open. Orithel is waiting at the Spire.";
    if (state.boss && state.boss.alive) return "Nine hundred years are awake and screaming";
    return "The Spire falls silent";
  }
```

- [ ] **Step 4: Leave the interaction prompts alone — deliberately**

`updatePrompt` at `GameFlowSystem.ts:57-70` produces
`"Press E to rest at the wayfire"`, `"Press E to speak with Orithel"`, and
`"Press E to read note"`. The spec lists these as text sites, and the
decision is that **all three stay exactly as they are.**

They are interface, not narration: a player reads them hundreds of times,
and a prompt that editorialises would tip the wayfires long before §6 earns
it. The implication is carried by the wayfire *rest* text rewritten in
Task 7 ("everything you are carrying is noted down somewhere you cannot
see"), which the player reads once per wayfire rather than constantly.

Do not change them. This step exists so a later reader can tell the
difference between a decision and an oversight.

- [ ] **Step 5: Update the initial HUD objective**

In `src/stores/useGameStore.ts`, `initialHud.objective` still reads
`"Recover the Anima Shards  (0/9)"`. Change it to match:

```typescript
  objective: "Read the roads. Record what was taken.",
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 7: Commit**

```bash
git add src/game/systems/GameFlowSystem.ts src/game/systems/GameFlowSystem.test.ts src/stores/useGameStore.ts
git commit -m "Rewrite HUD objectives in the player's voice

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: Save round-trip for a rewardless resolution

A resolution that grants nothing must still survive a save, or the player
who chose `end` would reload into a quest they can resolve again.

**Files:**
- Test: `src/game/core/WorldState.test.ts`

**Interfaces:**
- Consumes: `QuestProgress` and the `end` choice from Task 1.

- [ ] **Step 1: Write the test**

`WorldState.snapshot()` uses `structuredClone(this.quests)` and `restore()`
uses `structuredClone(snapshot.quests ?? ...)`, so resolutions are already
stored verbatim and this test should pass on the first run. It exists to
pin that behaviour, because a resolution carrying no reward is exactly the
kind of thing a future "don't save empty rewards" optimisation would drop.

Add to `src/game/core/WorldState.test.ts`, inside the existing
`describe("WorldState snapshots", ...)` block:

```typescript
  it("round-trips a resolution that granted no reward", () => {
    const world = new WorldState();
    world.quests = {
      facts: ["courier-orders", "courier-memory"],
      resolutions: { courier: "end" },
    };

    const snapshot = world.snapshot();
    world.quests.resolutions.courier = "bind";

    const restored = new WorldState();
    restored.restore(snapshot);

    expect(restored.quests.resolutions.courier).toBe("end");
    expect(restored.quests.facts).toEqual(["courier-orders", "courier-memory"]);
  });
```

The mutation between snapshot and restore proves the snapshot holds its own
copy rather than a live reference.

- [ ] **Step 2: Run it**

Run: `npx vitest run src/game/core/WorldState.test.ts`
Expected: PASS. If it fails, `snapshot()`/`restore()` are dropping or
sharing quest state — fix them to clone resolutions verbatim and re-run.

- [ ] **Step 3: Commit**

```bash
git add src/game/core/WorldState.test.ts src/game/core/WorldState.ts
git commit -m "Cover save round-trip for a rewardless quest resolution

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Full verification and playthrough

**Files:** none (verification only).

- [ ] **Step 1: Full suite and type-check**

Run: `npx vitest run && npx tsc --noEmit && npm run build`
Expected: all tests pass, no type errors, build succeeds.

- [ ] **Step 2: Confirm no stale copy survives**

Run:

```bash
grep -rn "long dreaming\|Recover the Anima Shards\|shepherds. But when\|nothing they loved\|gentler story\|so the child could dream" src/ || echo "clean"
```

Expected: `clean`. Every hit is a line this plan replaced; if one appears,
that site was missed.

- [ ] **Step 3: Confirm the verbatim-kept strings are still present**

Run:

```bash
grep -rn "THE NINTH MEMORY IS NOT MINE\|You never do\|THE SPIRE FALLS SILENT\|YOUR LIGHT FADES\|OPEN YOUR EYES\|WALK AGAIN\|RISE AGAIN" src/
```

Expected: every one of those strings found. They are load-bearing and must
not have been "improved" during the rewrite.

- [ ] **Step 4: Confirm the bounded reference appears exactly once**

Run:

```bash
grep -rc "incapable of complaint" src/game/map.ts src/game/quests.ts
```

Expected: `1` in each file — the ledger sign and the matching quest
evidence, and nowhere else. Then run
`grep -rn "collectors did with them" src/ | wc -l` and expect `2` (the same
two sites).

- [ ] **Step 5: Headless playthrough**

Start the dev server (`npm run dev`, poll `http://localhost:5173`) and drive
it with Playwright, as was done for
`docs/superpowers/plans/2026-09-12-procedural-sprite-pipeline.md` Task 14.
Confirm, with screenshots:

1. The content warning appears before the title screen, and pressing Enter
   dismisses it **without** also starting a run.
2. Reloading the page does not show the warning again.
3. The rewritten intro plays; shot 4 is unchanged.
4. Orithel's opening conversation reads in the new register.
5. Reading a sign shows rewritten text.
6. `console --errors` reports nothing.

Stop the server with `lsof -ti:5173 -sTCP:LISTEN | xargs -r kill`.

- [ ] **Step 6: Verify both ward branches**

The ward needs nine shards, which is a long play. Drive it instead through
the engine in a browser context or a focused test: confirm that
`ending:surrender` calls `spawnBoss()` and leaves the run playable, and that
`ending:refuse` ends the run with `refusal` and renders
`THE SPIRE HEARS YOU`. Confirm that walking away from the ward without
choosing reopens the dialogue on return.

- [ ] **Step 7: Update the roadmap**

`ROADMAP.md`'s Milestone 1 describes the three investigations in their old,
gentle terms ("compare the orders", "compare the salt-graves ledger"). Update
that section to describe them as they now are, and note the game's hard-M
content rating under "Production bar".

- [ ] **Step 8: Final commit**

```bash
git add -A
git commit -m "Verify the narrative rewrite and update the roadmap

Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
