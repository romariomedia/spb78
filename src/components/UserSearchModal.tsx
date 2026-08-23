import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, UserPlus, UserCheck, Crown, Trophy, X } from 'lucide-react';
import { UserProfile } from '../lib/types';
import { updateProfile } from '../services/repository';
import { triggerHapticNotification, triggerHapticImpact } from '../services/native';
import { Modal } from './Modal';

interface UserSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  allUsers: UserProfile[];
  isPremium: boolean;
  onFriendAdded?: (userId: string) => void;
}

export const UserSearchModal: React.FC<UserSearchModalProps> = ({
  isOpen, onClose, currentUser, allUsers, isPremium, onFriendAdded
}) => {
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Фильтруем результаты поиска
  const results = useMemo(() => {
    if (!query.trim()) return [];

    const searchTerm = query.toLowerCase().trim();
    return allUsers
      .filter((u) => {
        // Исключаем текущего пользователя и уже добавленных друзей
        if (u.id === currentUser?.id) return false;
        if (currentUser?.friendIds?.includes(u.id)) return false;

        // Ищем по имени, фамилии и полному имени
        const fullName = `${u.name || ''} ${u.bio || ''}`.toLowerCase();
        return (
          u.name?.toLowerCase().includes(searchTerm) ||
          fullName.includes(searchTerm)
        );
      })
      .sort((a, b) => {
        // Сортируем по релевантности (точное совпадение в начале)
        const aMatch = a.name?.toLowerCase().startsWith(searchTerm) ? 1 : 0;
        const bMatch = b.name?.toLowerCase().startsWith(searchTerm) ? 1 : 0;
        return bMatch - aMatch;
      })
      .slice(0, 50); // Максимум 50 результатов
  }, [query, allUsers, currentUser]);

  const handleAddFriend = async (userId: string) => {
    if (!isPremium || !currentUser) {
      triggerHapticNotification('warning');
      setError('Добавление друзей доступно только для Premium пользователей');
      return;
    }

    setBusy(userId);
    setError('');
    triggerHapticImpact('medium');

    try {
      const updatedFriends = [...(currentUser.friendIds || []), userId];
      await updateProfile({ friendIds: updatedFriends });
      triggerHapticNotification('success');
      onFriendAdded?.(userId);
      setQuery('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить в друзья');
      triggerHapticNotification('warning');
    } finally {
      setBusy(null);
    }
  };

  const isFriend = (userId: string) => currentUser?.friendIds?.includes(userId);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="🔍 Найти друга"
      subtitle="Поиск по имени или фамилии"
    >
      <div className="space-y-4">
        {/* Поле поиска */}
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите имя, фамилию или ник..."
            className="w-full pl-11 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Сообщение об ошибке */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs font-bold text-rose-300">
            {error}
          </div>
        )}

        {/* Premium напоминание */}
        {!isPremium && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs font-bold text-amber-300 flex items-center gap-2">
            <Crown className="w-3.5 h-3.5" />
            Только для Premium пользователей
          </div>
        )}

        {/* Результаты поиска */}
        <div className="max-h-96 overflow-y-auto space-y-2">
          {results.length === 0 && query && (
            <div className="text-center py-6 text-slate-500 text-sm">
              Никого не найдено по запросу «{query}»
            </div>
          )}

          {results.length === 0 && !query && (
            <div className="text-center py-6 text-slate-500 text-sm">
              Начните вводить имя для поиска
            </div>
          )}

          <AnimatePresence>
            {results.map((user) => (
              <motion.div
                key={user.id}
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="flex items-center gap-3 p-3 bg-slate-900/50 border border-slate-800 rounded-2xl hover:border-slate-700 transition"
              >
                {/* Аватар */}
                <img
                  src={user.avatar}
                  alt={user.name}
                  className="w-11 h-11 rounded-full object-cover border border-slate-700 shrink-0"
                />

                {/* Информация */}
                <div className="flex-1 min-w-0">
                  <h4 className="text-xs font-bold text-white truncate">
                    {user.name}, {user.age}
                  </h4>
                  <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400">
                    <Trophy className="w-3 h-3 text-amber-400" />
                    <span>{user.rating.toFixed(1)}</span>
                    {user.totalWorkouts > 0 && (
                      <>
                        <span>•</span>
                        <span>{user.totalWorkouts} тренировок</span>
                      </>
                    )}
                  </div>
                  {user.sports.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {user.sports.slice(0, 2).map((s) => (
                        <span
                          key={s}
                          className="text-[9px] bg-emerald-500/15 text-emerald-400 px-1.5 py-0.5 rounded-full border border-emerald-500/30"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Кнопка действия */}
                {isFriend(user.id) ? (
                  <div className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/15 border border-emerald-500/30 rounded-lg text-emerald-400">
                    <UserCheck className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">Друг</span>
                  </div>
                ) : (
                  <button
                    onClick={() => handleAddFriend(user.id)}
                    disabled={busy === user.id || !isPremium}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-400 active:scale-90 disabled:opacity-40 text-slate-950 rounded-lg transition shrink-0"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-bold">
                      {busy === user.id ? '...' : 'Добавить'}
                    </span>
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Footer */}
        {results.length > 0 && (
          <p className="text-[10px] text-slate-500 text-center pt-2">
            Найдено: {results.length} {results.length === 1 ? 'пользователь' : results.length < 5 ? 'пользователя' : 'пользователей'}
          </p>
        )}
      </div>
    </Modal>
  );
};
