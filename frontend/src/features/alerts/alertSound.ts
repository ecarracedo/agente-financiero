/**
 * Short WebAudio beep played when a new alert crossing pops up.
 *
 * Browsers only allow audio after a user gesture, so the shared audio context is
 * created and resumed from a one-time `pointerdown` listener. If the context is
 * blocked or unavailable, playback is skipped and the visual toast still works:
 * sound is an enhancement, never a requirement for delivery.
 */

/** Audio context implementation, including the legacy Safari prefix. */
type AudioContextConstructor = typeof AudioContext

/** The single lazily created context shared by every beep. */
let context: AudioContext | null = null

/** Return the browser's audio context constructor, if it has one. */
function audioContextConstructor(): AudioContextConstructor | null {
  const candidate =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextConstructor })
      .webkitAudioContext
  return candidate ?? null
}

/**
 * Create or resume the shared context from a user gesture.
 *
 * Safe to call repeatedly: it is a no-op once the context is running.
 */
export function unlockAlertSound(): void {
  const Constructor = audioContextConstructor()
  if (!Constructor) return
  try {
    if (context === null) context = new Constructor()
    if (context.state === 'suspended') void context.resume()
  } catch {
    // A browser that refuses an audio context simply gets silent toasts.
    context = null
  }
}

/**
 * Play one short beep.
 *
 * @returns `true` when a tone was scheduled, `false` when audio was blocked or
 * unavailable. Callers can ignore the result; the popup is unaffected either
 * way.
 */
export function playAlertSound(): boolean {
  if (context === null || context.state !== 'running') return false
  try {
    const now = context.currentTime
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(880, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.12, now + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.18)
    return true
  } catch {
    return false
  }
}
