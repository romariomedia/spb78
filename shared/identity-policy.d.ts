export function normalizePersonName(value: unknown, max?: number): string;
export function isUsablePersonName(value: unknown, email?: string): boolean;
export function chooseCanonicalPersonName(input?: {
  currentName?: unknown;
  firebaseName?: unknown;
  candidateName?: unknown;
  email?: string;
}): string;
