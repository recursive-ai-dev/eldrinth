export interface FixedStepLoopCallbacks {
  simulate: (stepSeconds: number) => void;
  render: (interpolation: number) => void;
  onError?: (error: unknown) => void;
}

/**
 * Owns browser-frame scheduling only. Game state advances in fixed quanta;
 * rendering observes the latest completed simulation state.
 */
export class FixedStepLoop {
  private animationFrame = 0;
  private previousFrameMs: number | null = null;
  private accumulator = 0;
  private active = false;

  constructor(
    private readonly callbacks: FixedStepLoopCallbacks,
    readonly stepSeconds = 1 / 60,
    private readonly maxFrameSeconds = 0.25,
    private readonly maxStepsPerFrame = 8,
  ) {}

  start() {
    if (this.active) return;
    this.active = true;
    this.previousFrameMs = null;
    this.animationFrame = requestAnimationFrame(this.frame);
  }

  stop() {
    this.active = false;
    cancelAnimationFrame(this.animationFrame);
    this.animationFrame = 0;
    this.previousFrameMs = null;
    this.accumulator = 0;
  }

  private frame = (nowMs: number) => {
    if (!this.active) return;

    try {
      const previousMs = this.previousFrameMs ?? nowMs;
      this.previousFrameMs = nowMs;
      const frameSeconds = Math.min(this.maxFrameSeconds, Math.max(0, (nowMs - previousMs) / 1000));
      this.accumulator += frameSeconds;

      let steps = 0;
      while (this.accumulator >= this.stepSeconds && steps < this.maxStepsPerFrame) {
        this.callbacks.simulate(this.stepSeconds);
        this.accumulator -= this.stepSeconds;
        steps++;
      }

      // Drop excess catch-up work after a tab stall; the simulation never gets
      // a giant variable delta and the browser remains responsive.
      if (steps === this.maxStepsPerFrame) this.accumulator = 0;
      this.callbacks.render(this.accumulator / this.stepSeconds);
      this.animationFrame = requestAnimationFrame(this.frame);
    } catch (error) {
      this.stop();
      this.callbacks.onError?.(error);
    }
  };
}
