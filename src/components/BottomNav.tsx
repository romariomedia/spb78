import React from 'react';
import { motion } from 'framer-motion';
import { Users, Dumbbell, Newspaper, User, Sparkles, MessageCircle } from 'lucide-react';
import { TabType } from '../lib/types';
import { triggerHapticImpact } from '../services/native';

interface BottomNavProps {
  activeTab: TabType;
  onChangeTab: (tab: TabType) => void;
  unreadCount?: number;
  chatUnreadCount?: number;
  isPremium?: boolean;
}

interface NavItem {
  id: TabType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge: number;
  special?: boolean;
  locked?: boolean;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onChangeTab,
  unreadCount = 0,
  chatUnreadCount = 0,
  isPremium = false
}) => {
  const navItems: NavItem[] = [
    { id: 'discover', label: 'Знакомства', icon: Users, badge: 0 },
    { id: 'trainings', label: 'Тренировки', icon: Dumbbell, badge: 0 },
    { id: 'chats', label: 'Чаты', icon: MessageCircle, badge: isPremium ? chatUnreadCount : 0, locked: !isPremium },
    { id: 'feed', label: 'Лента', icon: Newspaper, badge: unreadCount },
    { id: 'profile', label: 'Профиль', icon: User, badge: 0, special: true }
  ];

  const handleTabClick = (id: TabType) => {
    if (activeTab !== id) {
      triggerHapticImpact('light');
      onChangeTab(id);
    }
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-950/95 backdrop-blur-xl border-t border-slate-800 pb-safe shadow-[0_-4px_25px_rgba(0,0,0,0.6)]">
      <div className="max-w-md mx-auto px-2 pt-2 pb-2 flex justify-around items-center relative">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => handleTabClick(item.id)}
              className="relative flex-1 flex flex-col items-center justify-center py-1.5 px-1 rounded-2xl group focus:outline-none transition-all duration-150 active:scale-95"
              aria-label={item.label}
            >
              {/* Active animated background glow */}
              {isActive && (
                <motion.div
                  layoutId="bottom-nav-indicator"
                  className="absolute inset-0 bg-emerald-500/15 rounded-2xl border border-emerald-500/30 -z-10"
                  transition={{ type: "spring", stiffness: 350, damping: 25 }}
                />
              )}

              <div className="relative">
                <Icon
                  className={`w-6 h-6 transition-colors duration-200 ${
                    isActive
                      ? 'text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.8)]'
                      : 'text-slate-400 group-hover:text-slate-200'
                  }`}
                />
                
                {/* Notification Badge */}
                {item.badge > 0 && (
                  <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[10px] font-extrabold w-4 h-4 rounded-full flex items-center justify-center border border-slate-950 shadow">
                    {item.badge}
                  </span>
                )}

                {/* Premium profile sparkle indicator */}
                {item.special && isActive && (
                  <Sparkles className="w-3 h-3 text-amber-400 absolute -top-1 -right-1.5 animate-bounce" />
                )}

                {/* Premium-only lock indicator (Чаты) */}
                {item.locked && (
                  <span className="absolute -top-1.5 -right-2 text-[10px] leading-none drop-shadow">🔒</span>
                )}
              </div>

              <span
                className={`text-[11px] font-medium mt-1 tracking-tight transition-colors duration-200 ${
                  isActive ? 'text-emerald-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
