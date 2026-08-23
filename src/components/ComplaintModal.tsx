import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Mail, MessageSquareWarning, ShieldAlert } from 'lucide-react';
import { ChatThread, UserProfile } from '../lib/types';
import { APP_LEGAL_INFO } from '../lib/legal';
import { formatTimeLabel } from '../services/chats';
import { triggerHapticNotification } from '../services/native';
import { Modal } from './Modal';

const SUPPORT_EMAIL = APP_LEGAL_INFO.email;
const REPORTS_KEY = 'sportbuddy_sent_reports_v1';

interface ReportableContact {
  user: UserProfile;
  thread: ChatThread;
}

interface ComplaintModalProps {
  isOpen: boolean;
  onClose: () => void;
  reporter: UserProfile | null;
  contacts: ReportableContact[];
}

function saveLocalReport(thread: ChatThread, target: UserProfile): void {
  try {
    const raw = localStorage.getItem(REPORTS_KEY);
    const reports = raw ? (JSON.parse(raw) as unknown[]) : [];
    reports.push({
      id: `report_${Date.now()}`,
      chatId: thread.id,
      targetId: target.id,
      createdAt: new Date().toISOString(),
      status: 'email-opened'
    });
    localStorage.setItem(REPORTS_KEY, JSON.stringify(reports.slice(-30)));
  } catch {
    /* report can still be sent by e-mail */
  }
}

function buildMailto(reporter: UserProfile, target: UserProfile, thread: ChatThread): string {
  const recent = thread.messages.slice(-3).map((message) => {
    const author = message.senderId === reporter.id ? reporter.name : target.name;
    return `[${formatTimeLabel(message.timestamp)}] ${author}: ${message.text}`;
  });

  const subject = `Жалоба SportBuddy78: ${target.name} (${target.id})`;
  const body = [
    'ЖАЛОБА НА СОБЕСЕДНИКА SPORTBUDDY78',
    '',
    `Заявитель: ${reporter.name}`,
    `ID заявителя: ${reporter.id}`,
    `Собеседник: ${target.name}`,
    `ID собеседника: ${target.id}`,
    `Чат: ${thread.id}`,
    `Дата: ${new Date().toLocaleString('ru-RU')}`,
    '',
    'Причина: потенциально небезопасное или неспортивное предложение в чате.',
    '',
    'Последние сообщения в диалоге:',
    ...(recent.length > 0 ? recent : ['Сообщения недоступны.']),
    '',
    'Прошу провести проверку в соответствии с правилами безопасности SportBuddy78.'
  ].join('\n');

  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

export const ComplaintModal: React.FC<ComplaintModalProps> = ({
  isOpen, onClose, reporter, contacts
}) => {
  const [sentTo, setSentTo] = useState<string | null>(null);

  const handleSelect = (contact: ReportableContact) => {
    if (!reporter) return;
    triggerHapticNotification('warning');
    saveLocalReport(contact.thread, contact.user);
    setSentTo(contact.user.id);

    // Mobile browser/Capacitor opens the configured mail client with the
    // complaint addressed to support automatically after the user selection.
    window.setTimeout(() => {
      window.location.href = buildMailto(reporter, contact.user, contact.thread);
    }, 180);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => { setSentTo(null); onClose(); }}
      title="Пожаловаться на собеседника"
      subtitle="Выберите человека из ваших реальных диалогов"
      footer={
        <button
          onClick={() => { setSentTo(null); onClose(); }}
          className="w-full rounded-2xl bg-slate-800 py-3 text-xs font-black text-slate-300 active:scale-[0.98]"
        >
          Закрыть
        </button>
      }
    >
      <div className="space-y-3">
        <div className="flex items-start gap-2.5 rounded-2xl border border-amber-400/40 bg-amber-400/[0.08] p-3">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <p className="text-[11px] leading-relaxed text-slate-200">
            После выбора откроется письмо в службу поддержки. Жалоба будет автоматически
            адресована на <b className="text-amber-300">{SUPPORT_EMAIL}</b> с данными диалога.
          </p>
        </div>

        {contacts.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6 text-center">
            <MessageSquareWarning className="mx-auto h-8 w-8 text-slate-600" />
            <p className="mt-2 text-xs font-bold text-slate-300">Нет диалогов для выбора</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Пожаловаться можно после того, как в чате было хотя бы одно сообщение.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {contacts.map((contact) => {
              const last = contact.thread.messages[contact.thread.messages.length - 1];
              const isSent = sentTo === contact.user.id;
              return (
                <motion.button
                  key={contact.thread.id}
                  whileTap={{ scale: 0.985 }}
                  onClick={() => handleSelect(contact)}
                  disabled={isSent}
                  className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${
                    isSent
                      ? 'border-emerald-500/50 bg-emerald-500/10'
                      : 'border-slate-800 bg-slate-950 hover:border-rose-500/50'
                  }`}
                >
                  <img
                    src={contact.user.avatar}
                    alt={contact.user.name}
                    loading="lazy"
                    className="h-11 w-11 shrink-0 rounded-full border border-slate-700 object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-black text-white">{contact.user.name}</p>
                    <p className="mt-0.5 truncate text-[10px] text-slate-500">
                      {last ? last.text : 'Диалог'}
                    </p>
                  </div>
                  {isSent ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-400" />
                  ) : (
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
                      <AlertTriangle className="h-4 w-4" />
                    </span>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {sentTo && (
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] font-bold text-emerald-300">
            <Mail className="h-3.5 w-3.5" /> Письмо подготовлено для службы поддержки
          </p>
        )}
      </div>
    </Modal>
  );
};