/** Extracts a message from a thrown value of unknown shape. */
export function describeThrown(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
