import { ArrowUpRight, MapPin, MoveRight, Waves } from 'lucide-react';

/** Decorative river illustration, not a navigational map. */
export function NevaScene() {
  return <svg viewBox="0 0 640 360" className="sb-neva-scene" fill="none" aria-hidden="true">
    <defs>
      <linearGradient id="neva-water" x1="0" y1="0" x2="620" y2="340" gradientUnits="userSpaceOnUse"><stop stopColor="#315df9"/><stop offset="1" stopColor="#73adfd"/></linearGradient>
      <pattern id="neva-grid" width="38" height="38" patternUnits="userSpaceOnUse"><path d="M38 0H0V38" stroke="#a4b4d1" strokeOpacity=".09"/></pattern>
    </defs>
    <rect width="640" height="360" fill="url(#neva-grid)"/>
    <path d="M-60 350C100 300 138 111 270 169S460 268 690 35" stroke="url(#neva-water)" strokeWidth="79"/>
    <path d="M-60 350C100 300 138 111 270 169S460 268 690 35" stroke="#c5ddff" strokeOpacity=".45" strokeDasharray="3 12"/>
    <path d="M172 128L225 206M395 177L441 239" stroke="#dde7f6" strokeWidth="9"/>
    <path d="M171 125L225 204M397 175L442 237" stroke="#1b2c44" strokeWidth="3"/>
    <path d="M230 95L276 95L302 114L373 88L421 110" stroke="#c9f86e" strokeWidth="2" strokeDasharray="5 6"/>
    <g fill="#c9f86e" stroke="#172b27" strokeWidth="6"><circle cx="230" cy="95" r="9"/><circle cx="421" cy="110" r="9"/></g>
    <g stroke="#e4edff" strokeWidth="2"><path d="M328 112V59L335 43L342 59V112M335 43V14M319 112H351M325 84H345"/><path d="M481 279H555M490 279V255H546V279M494 255C494 221 542 221 542 255M518 230V209"/></g>
    <g fill="#b4c4df" fontSize="10" fontFamily="system-ui" letterSpacing="2"><text x="203" y="72">ТВОЙ СТАРТ</text><text x="424" y="91">НОВАЯ ВСТРЕЧА</text><text x="304" y="274" transform="rotate(-15 304 274)">НЕВА</text></g>
    <circle cx="538" cy="64" r="23" fill="#c9f86e"/><path d="M528 73L546 55M534 55H546V67" stroke="#102015" strokeWidth="2"/>
  </svg>;
}

interface Props {
  trainingCount: number;
  onTrainings: () => void;
  onDiscover: () => void;
  onSport: (sport: string) => void;
}
export function CityPulse({ trainingCount, onTrainings, onDiscover, onSport }: Props) {
  const trainingWord = new Intl.PluralRules('ru').select(trainingCount);
  const trainingLabel = trainingWord === 'one' ? 'тренировка' : trainingWord === 'few' ? 'тренировки' : 'тренировок';
  return <section className="sb-city-pulse" aria-label="Твой спортивный Петербург">
    <div className="sb-city-copy">
      <div className="sb-eyebrow"><span className="sb-live-dot"/> САНКТ-ПЕТЕРБУРГ <span className="sb-city-code">59.94° N / 30.31° E</span></div>
      <h2>Культ спорта<br/><span>и здоровых отношений</span></h2>
      <p>Знакомься через спорт.<br/>От первой тренировки — к своей компании.</p>
      <div className="sb-city-actions">
        <button onClick={onTrainings} className="sb-primary-action">Найти тренировку <ArrowUpRight size={18}/></button>
        <button onClick={onDiscover} className="sb-text-action">Найти людей <MoveRight size={16}/></button>
      </div>
      <div className="sb-city-foot"><Waves size={15}/><span>Город объединяет. Спорт знакомит.</span></div>
    </div>
    <div className="sb-city-art"><NevaScene/><div className="sb-city-ticket"><MapPin size={18}/><div><strong>Встречаемся в Петербурге</strong><span>{trainingCount > 0 ? `${trainingCount} ${trainingLabel} в сообществе` : 'Твоя следующая встреча — впереди'}</span></div></div></div>
    <div className="sb-sport-shortcuts"><span>НАЧНИ С ЛЮБИМОГО</span>{['Бег','Теннис','Футбол','Велопрогулка'].map((sport,index)=><button key={sport} onClick={()=>onSport(sport)}><span className="sb-sport-number">0{index+1}</span>{sport}<ArrowUpRight size={14}/></button>)}</div>
  </section>;
}
