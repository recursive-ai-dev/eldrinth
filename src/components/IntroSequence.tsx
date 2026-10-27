import { useCallback, useEffect, useRef, useState } from "react";
import titleBg from "@/assets/title.jpg";

const SHOT_LENGTHS = [3600, 5200, 5200, 4700, 6000, 0] as const;

const MEMORY_WORDS = ["INTAKE", "YIELD", "ROLLS", "UNITS", "WASTAGE", "PERMITTED"];

export default function IntroSequence({ onComplete }: { onComplete: () => void }) {
  const [shot, setShot] = useState(0);
  const finished = useRef(false);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    onComplete();
  }, [onComplete]);

  const advance = useCallback(() => {
    setShot((current) => {
      if (current >= SHOT_LENGTHS.length - 1) {
        finish();
        return current;
      }
      return current + 1;
    });
  }, [finish]);

  useEffect(() => {
    const duration = SHOT_LENGTHS[shot];
    if (!duration) return;
    const timer = window.setTimeout(advance, duration);
    return () => window.clearTimeout(timer);
  }, [advance, shot]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // One held Enter would otherwise advance a shot per repeat and skip the
      // whole cinematic in a fraction of a second.
      if (event.repeat) return;
      if (event.key === "Escape") {
        event.preventDefault();
        finish();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [advance, finish]);

  return (
    // Not a dialog: nothing here is modal, and aria-live on the container made
    // a screen reader read the whole twenty-five second cinematic as a single
    // utterance. Each shot announces its own lines instead.
    <section
      className={`intro-root intro-shot-${shot}`}
      role="region"
      aria-label={`The recovered memory, part ${shot + 1} of 5`}
    >
      <div className="intro-backdrop" aria-hidden="true">
        <img src={titleBg} alt="" className="intro-image intro-image-main" />
        {shot === 2 && (
          <>
            <img src={titleBg} alt="" className="intro-image intro-slice intro-slice-a" />
            <img src={titleBg} alt="" className="intro-image intro-slice intro-slice-b" />
            <img src={titleBg} alt="" className="intro-image intro-slice intro-slice-c" />
          </>
        )}
        <div className="intro-eclipse" />
        <div className="intro-orbit intro-orbit-a" />
        <div className="intro-orbit intro-orbit-b" />
        <div className="intro-bloom" />
        <div className="intro-shutter" />
      </div>

      <div className="intro-noise" aria-hidden="true" />
      <div className="intro-scanlines" aria-hidden="true" />
      <div className="intro-letterbox intro-letterbox-top" aria-hidden="true" />
      <div className="intro-letterbox intro-letterbox-bottom" aria-hidden="true" />

      <div key={shot} className="intro-content">
        {shot === 0 && (
          <div className="intro-opening">
            <div className="intro-archive-tag">
              MNEMONIC ARCHIVE <span>09</span> // RECOVERED
            </div>
            <p className="intro-whisper">There was a voice</p>
            <p className="intro-whisper intro-whisper-delay">before there was a world.</p>
            <div className="intro-signal">SIGNAL FOUND</div>
          </div>
        )}

        {shot === 1 && (
          <div className="intro-chapter intro-chapter-left">
            <div className="intro-index">I &nbsp; / &nbsp; THE KINDNESS</div>
            <p>The Elder Elves set out to build a mind</p>
            <p className="intro-line-delay-1">that would lose nothing.</p>
            <p className="intro-line-delay-2 intro-accent">A mind cannot be built. Only taken.</p>
          </div>
        )}

        {shot === 2 && (
          <div className="intro-chapter intro-chapter-center">
            <div className="intro-index">II &nbsp; / &nbsp; THE PROGRAM</div>
            <div className="intro-memory-words" aria-hidden="true">
              {MEMORY_WORDS.map((word, index) => (
                <span key={word} style={{ "--memory-index": index } as React.CSSProperties}>{word}</span>
              ))}
            </div>
            <p>They began with prisoners. Then the poor.</p>
            <p className="intro-line-delay-2 intro-accent">Then, when those ran out, their own officials.</p>
          </div>
        )}

        {shot === 3 && (
          <div className="intro-chapter intro-chapter-right">
            <div className="intro-index">III &nbsp; / &nbsp; THE SILENCE</div>
            <p>When the last Elf died,</p>
            <p className="intro-line-delay-1">the mind went on remembering</p>
            <p className="intro-line-delay-2">every death it had been made of.</p>
            <strong className="intro-alone">AWAKE.</strong>
          </div>
        )}

        {shot === 4 && (
          <div className="intro-transcript">
            <div className="intro-index">UNAUTHORIZED MEMORY // SOURCE UNKNOWN</div>
            <p><span>UNKNOWN</span>You have come for the nine pieces.</p>
            <p className="intro-line-delay-1"><span>WAYFARER</span>I don't remember coming before.</p>
            <p className="intro-line-delay-2"><span>UNKNOWN</span>You never do.</p>
            <div className="intro-warning">THE NINTH MEMORY IS NOT MINE.</div>
          </div>
        )}

        {shot === 5 && (
          <div className="intro-final">
            <div className="intro-final-rule" />
            <div className="intro-kicker">SOME DOORS ONLY OPEN FROM THE INSIDE</div>
            <h1>ELDRINTH</h1>
            <p>THE UNBOUND SPIRE</p>
            <button type="button" onClick={finish}>OPEN YOUR EYES</button>
          </div>
        )}
      </div>

      <button type="button" className="intro-skip" onClick={finish} aria-label="Skip introduction">
        ESC &nbsp; SKIP
      </button>

      <div className="intro-timeline" aria-hidden="true">
        {SHOT_LENGTHS.map((_, index) => (
          <span key={index} className={index < shot ? "complete" : index === shot ? "current" : ""}>
            {index === shot && shot < SHOT_LENGTHS.length - 1 && (
              <i style={{ animationDuration: `${SHOT_LENGTHS[shot]}ms` }} />
            )}
          </span>
        ))}
      </div>
      <div className="intro-continue">ENTER / SPACE &nbsp; CONTINUE</div>
    </section>
  );
}
