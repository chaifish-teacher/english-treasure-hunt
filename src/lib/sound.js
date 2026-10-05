let context;
export function playSound(kind, muted) {
  if (muted) return;
  try {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    context ||= new Audio();
    context.resume().catch(() => {});
    const notes =
      kind === "treasure"
        ? [523, 659, 784, 1047]
        : kind === "stage"
          ? [392, 523, 659]
          : kind === "checkpoint"
            ? [440, 659]
            : [420];
    notes.forEach((hz, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + i * 0.12;
      oscillator.type = "sine";
      oscillator.frequency.value = hz;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.055, start + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start(start);
      oscillator.stop(start + 0.17);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
      };
    });
  } catch {
    /* Sound is optional; gameplay always continues. */
  }
}
