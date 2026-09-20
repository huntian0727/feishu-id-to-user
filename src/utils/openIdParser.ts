const USER_ID_PATTERN = /\b[A-Za-z0-9_-]{4,64}\b/g;

export function extractUserIds(input: unknown): string[] {
  if (input === null || input === undefined) {
    return [];
  }

  const matches = String(input).match(USER_ID_PATTERN) ?? [];
  return [...new Set(matches.map((id) => id.trim()).filter(Boolean))];
}
