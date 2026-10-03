import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Users, MapPin, Dumbbell, MessageCircle, Newspaper, Crown,
  ChevronLeft, ChevronRight, Check, X, Sparkles, Smartphone
} from 'lucide-react';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';

const GUIDE_SEEN_KEY = 'sportbuddy_welcome_guide_v1';

/** Показывали ли уже окно возможностей на этом устройстве. */
export function hasSeenWelcomeGuide(): boolean {
  try {
    return localStorage.getItem(GUIDE_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

/** Запомнить, что окно показано: само оно больше не откроется, но остаётся доступным из шапки. */
export function markWelcomeGuideSeen(): void {
  try {
    localStorage.setItem(GUIDE_SEEN_KEY, '1');
  } catch {
    /* приватный режим — не запоминаем, покажем в следующий раз */
  }
}

interface GuideSlide {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  emoji: string;
  title: string;
  lead: string;
  points: string[];
  /** Градиент иконки и цвет свечения карточки. */
  accent: string;
  glow: string;
}

const SLIDES: GuideSlide[] = [
  {
    id: 'discover',
    icon: Users,
    emoji: '🤝',
    title: 'Знакомства по спорту',
    lead: 'Главная идея SportBuddy78 — знакомиться и общаться через спорт, а не через переписку ради переписки.',
    points: [
      'Свайп-карточки атлетов: по виду спорта, уровню и геолокации',
      'Взаимная симпатия открывает мэтч — дальше личный чат',
      'Бег, футбол, теннис, баскетбол, падел, хоккей, велопрогулка',
      'На бесплатном тарифе — 5 взаимных мэтчей за 7 дней, Premium снимает лимит'
    ],
    accent: 'from-emerald-500 to-teal-400',
    glow: 'shadow-[0_0_35px_rgba(16,185,129,0.25)]'
  },
  {
    id: 'nearby',
    icon: MapPin,
    emoji: '📍',
    title: 'Рядом с тобой',
    lead: 'Карта Санкт-Петербурга и радар показывают, кто тренируется поблизости.',
    points: [
      'Расстояния и «рядом» появляются только после разрешения геолокации',
      'Адрес в шапке обновляется по вашим координатам',
      'Разрешение можно выдать в браузере или в настройках приложения телефона',
      'Без координат приложение не выдумывает местоположение — просто скрывает расстояния'
    ],
    accent: 'from-sky-500 to-cyan-400',
    glow: 'shadow-[0_0_35px_rgba(14,165,233,0.25)]'
  },
  {
    id: 'trainings',
    icon: Dumbbell,
    emoji: '🏋️',
    title: 'Тренировки и запись',
    lead: 'Создавайте совместные тренировки и присоединяйтесь к чужим — с реальным местом встречи.',
    points: [
      'Создание тренировки с выбором точки на карте и лимитом участников',
      'Календарь ближайших тренировок и список записавшихся',
      'Отметка о прибытии по GPS: засчитывается рядом с местом встречи',
      'Рейтинг организаторов и участников после совместной тренировки'
    ],
    accent: 'from-violet-500 to-fuchsia-400',
    glow: 'shadow-[0_0_35px_rgba(139,92,246,0.25)]'
  },
  {
    id: 'chats',
    icon: MessageCircle,
    emoji: '💬',
    title: 'Чаты, друзья, уведомления',
    lead: 'После мэтча общение продолжается в чате — личном или групповом по тренировке.',
    points: [
      'Личные и групповые чаты в реальном времени',
      'Заявки в друзья и общий список друзей',
      'Уведомления о сообщениях, заявках и тренировках',
      'Жалоба на нарушителя — прямо из чата или из анкеты'
    ],
    accent: 'from-amber-500 to-orange-400',
    glow: 'shadow-[0_0_35px_rgba(245,158,11,0.25)]'
  },
  {
    id: 'feed',
    icon: Newspaper,
    emoji: '📸',
    title: 'Лента и видеозапись',
    lead: 'Показывайте тренировки и находите компанию по фотографиям и видео.',
    points: [
      'Публикации с фото и видео, лайки и комментарии',
      'Видеозапись: снять клип прямо с камеры и опубликовать с подписью',
      'Публикации открываются после подтверждения профиля',
      'Лента сортируется по времени — свежее всегда сверху'
    ],
    accent: 'from-rose-500 to-pink-400',
    glow: 'shadow-[0_0_35px_rgba(244,63,94,0.25)]'
  },
  {
    id: 'premium',
    icon: Crown,
    emoji: '🎁',
    title: 'Premium, награды, установка',
    lead: 'Сейчас бета-период: Premium открыт всем, а прогресс копится с первого дня.',
    points: [
      'Premium бесплатно до конца 2026 года: чаты, публикации, BOX',
      'Медали, серии входов и статистика тренировок',
      'SportBuddy BOX и промокоды — с 1 января 2027 года',
      'Установите на телефон: «Добавить на главный экран» или Android APK'
    ],
    accent: 'from-yellow-400 to-amber-500',
    glow: 'shadow-[0_0_35px_rgba(251,191,36,0.3)]'
  }
];

interface WelcomeGuideProps {
  isOpen: boolean;
  onClose: () => void;
  userName?: string;
  /** Вызывается по кнопке «Начать»: обычно ведёт на экран знакомств. */
  onStart?: () => void;
  /** С какого слайда открыть (0 — первый). Нужно для превью и точечного показа. */
  initialSlide?: number;
}

export const WelcomeGuide: React.FC<WelcomeGuideProps> = ({
  isOpen, onClose, userName, onStart, initialSlide = 0
}) => {
  const [index, setIndex] = useState(initialSlide);
  const [direction, setDirection] = useState(1);

  const slide = SLIDES[index] ?? SLIDES[0]!;
  const isLast = index === SLIDES.length - 1;

  // При открытии всегда начинаем с заданного слайда и блокируем прокрутку фона.
  useEffect(() => {
    if (!isOpen) return;
    const start = Math.min(Math.max(initialSlide, 0), SLIDES.length - 1);
    setIndex(start);
    setDirection(1);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous || 'unset';
    };
  }, [isOpen, initialSlide]);

  const close = useCallback(() => {
    triggerHapticImpact('light');
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, close]);

  const goTo = (next: number, dir: number) => {
    if (next < 0 || next >= SLIDES.length) return;
    triggerHapticImpact('light');
    setDirection(dir);
    setIndex(next);
  };

  const handleNext = () => {
    if (isLast) {
      triggerHapticNotification('success');
      onStart?.();
      return;
    }
    goTo(index + 1, 1);
  };

  const Icon = slide.icon;
  const greeting = userName ? `${userName}, это SportBuddy78` : 'Это SportBuddy78';

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[70] flex items-stretch justify-center sm:items-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
            className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Возможности SportBuddy78"
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', damping: 26, stiffness: 300 }}
            className="relative z-10 flex h-full w-full flex-col sm:h-auto sm:max-h-[92vh] sm:max-w-lg sm:p-4"
          >
            <div className="flex h-full flex-col overflow-hidden border-slate-800 bg-slate-900 pt-safe pb-safe shadow-2xl sm:rounded-3xl sm:border">
              {/* Header: прогресс и закрыть */}
              <div className="flex items-center gap-3 border-b border-slate-800/80 bg-slate-900/60 px-5 py-3.5">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    <Sparkles className="h-3 w-3 text-amber-400" />
                    Возможности проекта
                  </div>
                  <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-400"
                      animate={{ width: `${((index + 1) / SLIDES.length) * 100}%` }}
                      transition={{ type: 'spring', stiffness: 220, damping: 28 }}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-bold text-slate-500">{index + 1}/{SLIDES.length}</span>
                <button
                  onClick={close}
                  className="rounded-xl border border-slate-800 bg-slate-950 p-2 text-slate-400 transition hover:text-white active:scale-90"
                  aria-label="Закрыть"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Slide */}
              <div className="relative flex flex-1 flex-col justify-center overflow-y-auto no-scrollbar px-5 py-5">
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div
                    key={slide.id}
                    initial={{ opacity: 0, x: direction * 44 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: direction * -44 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="space-y-4"
                  >
                    <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br ${slide.accent} ${slide.glow}`}>
                      <Icon className="h-9 w-9 text-slate-950" />
                    </div>

                    <div className="text-center">
                      <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-emerald-400">
                        {index === 0 ? greeting : `Шаг ${index + 1} из ${SLIDES.length}`}
                      </p>
                      <h2 className="sb-display mt-1 text-xl font-black leading-tight text-white">
                        <span className="mr-1.5">{slide.emoji}</span>{slide.title}
                      </h2>
                      <p className="mt-2 text-xs leading-relaxed text-slate-300">{slide.lead}</p>
                    </div>

                    <ul className="space-y-2.5">
                      {slide.points.map((point) => (
                        <li key={point} className="flex items-start gap-2.5 rounded-2xl border border-slate-800 bg-slate-950/60 p-3">
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${slide.accent}`}>
                            <Check className="h-3 w-3 text-slate-950" />
                          </span>
                          <span className="text-[12px] leading-relaxed text-slate-200">{point}</span>
                        </li>
                      ))}
                    </ul>

                    {slide.id === 'premium' && (
                      <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-3.5">
                        <Smartphone className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                        <p className="text-[11px] leading-relaxed text-amber-100">
                          Советы новичку: включите геолокацию для карты и расстояний, добавьте личное фото
                          для подтверждения профиля и создайте первую тренировку — напарники найдутся быстрее.
                        </p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Footer: навигация */}
              <div className="space-y-3 border-t border-slate-800 bg-slate-950/70 px-5 py-4">
                <div className="flex items-center justify-center gap-1.5">
                  {SLIDES.map((item, itemIndex) => (
                    <button
                      key={item.id}
                      onClick={() => goTo(itemIndex, itemIndex > index ? 1 : -1)}
                      aria-label={`Слайд ${itemIndex + 1}: ${item.title}`}
                      aria-current={itemIndex === index}
                      className={`h-1.5 rounded-full transition-all ${
                        itemIndex === index ? 'w-6 bg-emerald-400' : 'w-1.5 bg-slate-700 hover:bg-slate-600'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2.5">
                  {index > 0 ? (
                    <button
                      onClick={() => goTo(index - 1, -1)}
                      className="flex items-center justify-center gap-1.5 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-300 transition active:scale-95"
                    >
                      <ChevronLeft className="h-4 w-4" /> Назад
                    </button>
                  ) : (
                    <button
                      onClick={close}
                      className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-xs font-bold text-slate-400 transition active:scale-95"
                    >
                      Пропустить
                    </button>
                  )}

                  <button
                    onClick={handleNext}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-2xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 py-3 text-sm font-black text-slate-950 shadow-[0_0_22px_rgba(16,185,129,0.35)] transition active:scale-[0.98]"
                  >
                    {isLast ? 'Начать знакомиться' : 'Далее'}
                    {!isLast && <ChevronRight className="h-4 w-4" />}
                  </button>
                </div>

                <p className="text-center text-[10px] font-bold uppercase tracking-[0.14em] text-slate-600">
                  Культ спорта и здоровых отношений • Санкт-Петербург
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
