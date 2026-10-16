/** Only the exact opt-in value enables the unfinished Planning V2 route flow. */
export function planningV2Enabled(value: unknown): boolean {
  return value === "true";
}
