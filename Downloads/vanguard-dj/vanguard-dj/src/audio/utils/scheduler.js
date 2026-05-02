/**
 * @fileoverview Audio Scheduler
 * Implements a lookahead scheduling system for beat-synchronized events.
 * Inspired by Chris Wilson's Web Audio Metronome pattern.
 * Ensures transitions, cues, and FX triggers are sample-accurate.
 */

/**
 * Scheduler class for queueing audio events ahead of playback time.
 * Uses a hybrid setTimeout + AudioContext.currentTime approach for
 * both precision and low CPU usage.
 */
export class Scheduler {
  /**
   * @param {AudioContext} audioContext - The shared AudioContext.
   * @param {Object} [options={}] - Configuration options.
   * @param {number} [options.lookahead=0.1] - How far ahead to schedule (seconds).
   * @param {number} [options.scheduleInterval=25] - setTimeout interval (ms).
   */
  constructor(audioContext, options = {}) {
    this.audioContext = audioContext;
    this.lookahead = options.lookahead || 0.1; // 100ms default
    this.scheduleInterval = options.scheduleInterval || 25; // 25ms default

    this.nextNoteTime = 0.0;
    this.isRunning = false;
    this.timerID = null;
    this.beatCallbacks = [];
    this.transitionCallbacks = [];

    // Beat grid configuration
    this.bpm = 124;
    this.beatsPerBar = 4;
    this.secondsPerBeat = 60 / this.bpm;
  }

  /**
   * Set the current BPM and recalculate timing constants.
   * @param {number} bpm - Beats per minute.
   */
  setBPM(bpm) {
    this.bpm = bpm;
    this.secondsPerBeat = 60 / bpm;
  }

  /**
   * Register a callback to fire on each scheduled beat.
   * @param {Function} callback - Receives (beatNumber, time).
   */
  onBeat(callback) {
    this.beatCallbacks.push(callback);
  }

  /**
   * Register a callback for scheduled transitions.
   * @param {Function} callback - Receives (transitionData, time).
   */
  onTransition(callback) {
    this.transitionCallbacks.push(callback);
  }

  /**
   * Remove a registered beat callback.
   * @param {Function} callback - The callback to remove.
   */
  offBeat(callback) {
    this.beatCallbacks = this.beatCallbacks.filter((cb) => cb !== callback);
  }

  /**
   * Start the scheduler loop.
   * @param {number} [startTime] - Optional AudioContext time to start from.
   */
  start(startTime) {
    if (this.isRunning) return;
    this.isRunning = true;
    this.nextNoteTime = startTime || this.audioContext.currentTime;
    this._schedulerLoop();
  }

  /**
   * Stop the scheduler loop.
   */
  stop() {
    this.isRunning = false;
    if (this.timerID) {
      clearTimeout(this.timerID);
      this.timerID = null;
    }
  }

  /**
   * Schedule a one-shot transition event at a specific beat offset.
   * @param {number} beatOffset - Beats from now to schedule.
   * @param {Object} transitionData - Data payload for the transition.
   */
  scheduleTransition(beatOffset, transitionData) {
    const targetTime = this.audioContext.currentTime + beatOffset * this.secondsPerBeat;
    this.transitionCallbacks.forEach((cb) => {
      try {
        cb(transitionData, targetTime);
      } catch (e) {
        console.error('[Scheduler] Transition callback error:', e);
      }
    });
  }

  /**
   * Internal lookahead loop.
   * Continuously checks if the next beat falls within the lookahead window
   * and fires callbacks with the precise AudioContext time.
   * @private
   */
  _schedulerLoop() {
    if (!this.isRunning) return;

    // Schedule all notes that fall within the lookahead window
    while (
      this.nextNoteTime <
      this.audioContext.currentTime + this.lookahead
    ) {
      this._scheduleBeat(this.nextNoteTime);
      this._advanceBeat();
    }

    this.timerID = setTimeout(() => this._schedulerLoop(), this.scheduleInterval);
  }

  /**
   * Fire all registered beat callbacks for a specific audio time.
   * @param {number} time - The audio context time to schedule at.
   * @private
   */
  _scheduleBeat(time) {
    this.beatCallbacks.forEach((cb) => {
      try {
        cb(time);
      } catch (e) {
        console.error('[Scheduler] Beat callback error:', e);
      }
    });
  }

  /**
   * Advance the internal beat tracker by one beat interval.
   * @private
   */
  _advanceBeat() {
    this.nextNoteTime += this.secondsPerBeat;
  }

  /**
   * Clean up all resources.
   */
  destroy() {
    this.stop();
    this.beatCallbacks = [];
    this.transitionCallbacks = [];
  }
}

