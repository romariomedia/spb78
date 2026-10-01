import { Gift, Sparkles, CalendarDays } from 'lucide-react';
import { isBetaActive } from '../lib/release';
export function BetaNotice() {
  if (!isBetaActive()) return null;
  return <section className="sb-beta-notice" aria-label="Открытый сезон SportBuddy">
    <span className="sb-beta-eyebrow"><Sparkles size={14}/> ОТКРЫТЫЙ СЕЗОН · 2026</span>
    <h3>Больше спорта.<br/><span>Больше своих людей.</span></h3>
    <p>Premium бесплатно для всех до <strong>31 декабря 2026</strong> включительно. Знакомьтесь, создавайте тренировки, общайтесь и делитесь моментами.</p>
    <div className="sb-beta-detail"><Gift size={20}/><div><strong>Награды — в запас</strong><p>Медали и промокоды за активность остаются с вами. С 1 января активируйте накопленные коды и продлевайте Premium бесплатно.</p></div></div>
    <div className="sb-beta-detail"><CalendarDays size={20}/><div><strong>SportBuddy BOX — с 1 января 2027</strong><p>Во время тестирования призы не выдаются. Прогресс тренировок сохраняется; после запуска действуют условия BOX и Premium.</p></div></div>
    <small>Без оплаты и автоматических списаний. С 1 января — обычные тарифы и бесплатный режим. Время — московское.</small>
  </section>;
}
