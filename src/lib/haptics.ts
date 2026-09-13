/** Tiny haptic tick on Android (iOS Safari ignores vibrate). Never throws. */
export function buzz(pattern: number | number[] = 12): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported */
  }
}
