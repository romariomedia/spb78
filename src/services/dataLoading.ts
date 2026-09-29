/** Each collection gets its own timeout and fallback; unrelated reads survive. */
export async function readSection<T>(request: Promise<T>, fallback: () => T, timeoutMs: number): Promise<{ value: T; stale: boolean }> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const value = await Promise.race([
      request,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Data request timed out')), timeoutMs);
      })
    ]);
    return { value, stale: false };
  } catch {
    return { value: fallback(), stale: true };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function joinedTrainingIds(trainings: { id: string; participantIds: string[] }[], uid: string | undefined): Set<string> {
  return new Set(trainings.filter(training => uid && training.participantIds.includes(uid)).map(training => training.id));
}
