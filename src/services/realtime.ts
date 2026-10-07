import { collection, query, where, onSnapshot, Unsubscribe } from 'firebase/firestore';
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
  onInvalidate: (sections: Set<InvalidatedSection>) => void
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
    onSnapshot(collection(db, 'users'), () => schedule('users'), () => undefined),
    onSnapshot(collection(db, 'trainings'), () => schedule('trainings'), () => undefined),
    onSnapshot(query(collection(db, 'feed'),where('isHidden','==',false)), () => schedule('feed'), () => undefined)
  ];

  return () => {
    if (timer) clearTimeout(timer);
    pending.clear();
    stops.forEach((stop) => stop());
  };
}
