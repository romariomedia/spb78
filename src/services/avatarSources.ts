/** A failed CDN derivative must not hide a still available original upload. */
export function avatarSources(src?: string): string[] {
  const candidates = src ? [src] : [];
  try {
    const url = new URL(src || '');
    if (url.hostname === 'res.cloudinary.com') {
      const restored = url.pathname.replace(/(\/image\/upload\/)f_auto,q_[^/]+\//, '$1');
      if (restored !== url.pathname) { url.pathname = restored; candidates.push(url.href); }
    }
  } catch { /* Local placeholders are supported. */ }
  candidates.push('/avatar-placeholder.svg');
  return [...new Set(candidates)];
}
