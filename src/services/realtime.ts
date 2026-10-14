import { doc, collection, onSnapshot, Unsubscribe } from 'firebase/firestore';
import { db } from '../lib/firebase';

/** Коллекции, изменения в которых делают локальное зеркало устаревшим. */
export type InvalidatedSection = 'users' | 'trainings' | 'feed';

/**
 * Минимальные слушатели инвалидации. Репозиторий остаётся нормализатором и
 * владельцем кэша; снимки лишь сообщают приложению, какие разделы устарели.
 *
 * Разделы накапливаются и отдаются одним вызовом: вызывающий код обновляет
 * только изменившееся. Раньше любой снимок приводил к полному перечитыванию
 * профиля, пользователей, тренировок и приватных полей.
 */
export function subscribeAppInvalidation(
  onInvalidate: (sections: Set<InvalidatedSection>) => void,
  userId: string
): Unsubscribe {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const pending = new Set<InvalidatedSection>();

  const schedule = (section: InvalidatedSection) => {
    pending.add(section);
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const sections = new Set(pending);
      pending.clear();
      timer = null;
      onInvalidate(sections);
    }, 350);
  };

  const stops = [
    onSnapshot(doc(db, 'users', userId), () => schedule('users'), () => undefined),
    onSnapshot(collection(db, 'trainings'), () => schedule('trainings'), () => undefined)
  ];

  // Other athletes are fetched through the public API, never a raw collection listener.
  const poll = setInterval(() => schedule('users'), 120_000);
  // Feed documents are private; only the filtered API may deliver posts.
  const feedPoll = setInterval(() => {
    if(typeof document==='undefined'||!document.hidden)schedule('feed');
  }, 60_000);
  return () => {
    clearInterval(poll);
    clearInterval(feedPoll);
    if (timer) clearTimeout(timer);
    pending.clear();
    stops.forEach((stop) => stop());
  };
}
