/** Prefer a bundled copy only when this exact official asset exists in this build. */
export function eventCoverSources(primary: string, fallback: string, bundledPaths: readonly string[]): string[] {
  const available = new Set(bundledPaths);
  const sources: string[] = [];
  for (const source of [primary, fallback]) {
    if (!source) continue;
    try {
      const url = new URL(source, 'https://sportbuddy78.pro');
      if (url.origin === 'https://sportbuddy78.pro' && available.has(url.pathname)) sources.push(url.pathname);
    } catch { /* Keep the original URL for the image error handler. */ }
    sources.push(source);
  }
  return [...new Set(sources)];
}
