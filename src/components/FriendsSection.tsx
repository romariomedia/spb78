import React from 'react';
import { motion } from 'framer-motion';
import { UserPlus, UserCheck, UserX, Crown, MessageCircle, Users2, Lock } from 'lucide-react';
import { UserProfile } from '../lib/types';
import {
  getFriends, getIncomingRequests, acceptFriendRequest,
  declineFriendRequest, removeFriend
} from '../services/friends';
import { CollapsibleCard } from './CollapsibleCard';

interface FriendsSectionProps {
  user: UserProfile;
  allUsers: UserProfile[];
  isPremium: boolean;
  onUpdateUser: (user: UserProfile) => void;
  onOpenProfile: (target: UserProfile) => void;
  onOpenChat: (target: UserProfile) => void;
  onGoPremium: () => void;
}

export const FriendsSection: React.FC<FriendsSectionProps> = ({
  user, allUsers, isPremium, onUpdateUser, onOpenProfile, onOpenChat, onGoPremium
}) => {
  const friends = getFriends(user, allUsers);
  const requests = getIncomingRequests(user, allUsers);

  if (!isPremium) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 space-y-3 shadow-xl text-center">
        <div className="w-14 h-14 rounded-3xl bg-amber-500/15 border border-amber-500/40 mx-auto flex items-center justify-center text-2xl">
          🔒
        </div>
        <h3 className="text-sm font-extrabold text-white">Друзья — функция Premium</h3>
        <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
          Добавляйте спортсменов Санкт-Петербурга в друзья, общайтесь в чате и следите
          за их прогрессом в таблице лидеров.
        </p>
        <button
          onClick={onGoPremium}
          className="w-full py-3 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 font-black rounded-2xl text-xs transition active:scale-95 flex items-center justify-center gap-2"
        >
          <Crown className="w-4 h-4 fill-slate-950" /> Открыть Premium
        </button>
      </div>
    );
  }

  return (
    <CollapsibleCard
      storageKey="sportbuddy_profile_friends_open_v1"
      className="bg-slate-900 border border-slate-800"
      defaultOpen={false}
      icon={
        <div className="w-11 h-11 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center">
          <Users2 className="w-5 h-5 text-emerald-400" />
        </div>
      }
      title="Мои друзья"
      subtitle="Спортивное сообщество СПб"
      collapsedSummary={
        requests.length > 0
          ? `${friends.length} друзей • ${requests.length} новых заявок`
          : `${friends.length} друзей`
      }
      badge={
        <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-lg border border-emerald-500/40">
          {requests.length > 0 ? `+${requests.length}` : friends.length}
        </span>
      }
    >
      {/* Incoming requests */}
      {requests.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-400">
            Заявки в друзья ({requests.length})
          </h4>
          {requests.map((r) => (
            <motion.div
              key={r.id}
              layout
              className="bg-slate-950 border border-amber-500/40 rounded-2xl p-3 flex items-center gap-3"
            >
              <img src={r.avatar} alt={r.name} loading="lazy"
                className="w-10 h-10 rounded-full object-cover border border-amber-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <h5 className="text-xs font-extrabold text-white truncate">{r.name}</h5>
                <p className="text-[10px] text-slate-400 truncate">{r.sports.slice(0, 2).join(' • ')}</p>
              </div>
              <button
                onClick={async () => onUpdateUser(await acceptFriendRequest(user, r.id))}
                className="p-2 bg-emerald-500 text-slate-950 rounded-xl active:scale-90 transition shrink-0"
                aria-label="Принять"
              >
                <UserCheck className="w-4 h-4" />
              </button>
              <button
                onClick={async () => onUpdateUser(await declineFriendRequest(user, r.id))}
                className="p-2 bg-slate-800 text-rose-400 border border-slate-700 rounded-xl active:scale-90 transition shrink-0"
                aria-label="Отклонить"
              >
                <UserX className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Friends list */}
      {friends.length === 0 ? (
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-6 text-center space-y-2">
          <UserPlus className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs font-bold text-slate-300">Список друзей пуст</p>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Добавляйте спортсменов в друзья из анкет в разделе «Знакомства» или из таблицы лидеров.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {friends.map((f) => (
            <motion.div
              key={f.id}
              layout
              className="bg-slate-950 border border-slate-800 hover:border-emerald-500/40 rounded-2xl p-3 flex items-center gap-3 transition"
            >
              <button onClick={() => onOpenProfile(f)} className="shrink-0">
                <img src={f.avatar} alt={f.name} loading="lazy"
                  className="w-11 h-11 rounded-full object-cover border-2 border-emerald-500/60" />
              </button>

              <button onClick={() => onOpenProfile(f)} className="flex-1 min-w-0 text-left">
                <h5 className="text-xs font-extrabold text-white truncate flex items-center gap-1">
                  {f.name}
                  {f.subscriptionPlan === 'premium' && (
                    <Crown className="w-3 h-3 fill-amber-400 text-amber-400 shrink-0" />
                  )}
                </h5>
                <p className="text-[10px] text-slate-400 truncate">{f.locationName}</p>
                <p className="text-[10px] text-emerald-400/80 truncate">
                  🏋️ {f.totalWorkouts} трен. • 🔥 {f.dailyMedalStreak} дн.
                </p>
              </button>

              <button
                onClick={() => onOpenChat(f)}
                className="p-2 bg-emerald-500/15 text-emerald-400 border border-emerald-500/40 rounded-xl active:scale-90 transition shrink-0"
                aria-label="Написать"
              >
                <MessageCircle className="w-4 h-4" />
              </button>
              <button
                onClick={async () => onUpdateUser(await removeFriend(user, f.id))}
                className="p-2 bg-slate-900 text-slate-500 hover:text-rose-400 border border-slate-800 rounded-xl active:scale-90 transition shrink-0"
                aria-label="Удалить из друзей"
              >
                <UserX className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>
      )}

      <p className="text-[10px] text-slate-600 flex items-center gap-1.5">
        <Lock className="w-3 h-3 shrink-0" />
        Общаться можно только со взаимными друзьями
      </p>
    </CollapsibleCard>
  );
};
