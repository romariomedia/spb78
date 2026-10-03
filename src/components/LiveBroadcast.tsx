import React, { useEffect, useRef, useState } from 'react';
import {
  Radio, Square, Video, VideoOff, Mic, MicOff, SwitchCamera, X, MapPin, AlertCircle
} from 'lucide-react';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';

interface LiveBroadcastProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  locationLabel: string;
  /**
   * Запись завершена: файл для публикации в ленте и длительность в секундах.
   * null означает, что устройство не смогло записать видео.
   *
   * Здесь намеренно нет «зрителей»: приложение не ведёт трансляцию, а честно
   * записывает видео на устройстве — запись уходит в ленту обычной публикацией.
   */
  onPublish: (title: string, durationSec: number, file: File | null) => void;
}

/** Кодеки в порядке предпочтения: webm тянет Android/Chrome, mp4 — iOS/Safari. */
const MIME_CANDIDATES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4'
];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return MIME_CANDIDATES.find((type) => {
    try {
      return MediaRecorder.isTypeSupported(type);
    } catch {
      return false;
    }
  });
}

export const LiveBroadcast: React.FC<LiveBroadcastProps> = ({
  isOpen, onClose, authorName, locationLabel, onPublish
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [title, setTitle] = useState('Тренировка в Санкт-Петербурге');

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const startCamera = async (mode: 'user' | 'environment') => {
    setError(null);
    try {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true
      });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
      setCamOn(true);
      setMicOn(true);
    } catch {
      setError('Нет доступа к камере. Разрешите доступ в настройках приложения.');
    }
  };

  useEffect(() => {
    if (isOpen) void startCamera(facing);
    return () => {
      const recorder = recorderRef.current;
      if (recorder && recorder.state !== 'inactive') {
        recorder.onstop = null;
        try {
          recorder.stop();
        } catch {
          /* уже остановлен */
        }
      }
      chunksRef.current = [];
      stopStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Таймер записи. Никаких «зрителей» и реакций: только реальная длительность.
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  if (!isOpen) return null;

  const toggleTrack = (kind: 'audio' | 'video') => {
    triggerHapticImpact('light');
    const tracks = kind === 'audio'
      ? streamRef.current?.getAudioTracks()
      : streamRef.current?.getVideoTracks();
    tracks?.forEach((t) => (t.enabled = !t.enabled));
    if (kind === 'audio') setMicOn((v) => !v);
    else setCamOn((v) => !v);
  };

  const handleFlip = () => {
    triggerHapticImpact('light');
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    void startCamera(next);
  };

  const handleStartRecording = () => {
    const stream = streamRef.current;
    const mimeType = pickMimeType();
    if (!stream || !mimeType) {
      setError('Это устройство не поддерживает запись видео. Опубликуйте видео из галереи.');
      return;
    }
    try {
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 2_500_000 });
      chunksRef.current = [];
      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onerror = () => setError('Сбой записи. Попробуйте ещё раз.');
      recorder.start(1000);
      recorderRef.current = recorder;
      triggerHapticNotification('success');
      setSeconds(0);
      setRecording(true);
    } catch {
      setError('Не удалось начать запись видео.');
    }
  };

  const buildRecordingFile = (): File | null => {
    const mimeType = recorderRef.current?.mimeType || 'video/webm';
    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size === 0) return null;
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
    return new File([blob], `training-${Date.now()}.${extension}`, { type: mimeType });
  };

  /** Остановка с сохранением: запись откроется в диалоге публикации с подписью. */
  const handleFinish = () => {
    triggerHapticImpact('heavy');
    const duration = seconds;
    const recorder = recorderRef.current;
    const complete = (file: File | null) => {
      stopStream();
      if (duration > 2) onPublish(title.trim() || 'Тренировка', duration, file);
      setRecording(false);
      onClose();
    };

    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => complete(buildRecordingFile());
      try {
        recorder.stop();
        return;
      } catch {
        /* запись уже остановлена — завершаем обычным путём */
      }
    }
    complete(buildRecordingFile());
  };

  /** Крестик во время записи: запись отменяется и никуда не публикуется. */
  const handleDiscard = () => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = null;
      try {
        recorder.stop();
      } catch {
        /* уже остановлен */
      }
    }
    chunksRef.current = [];
    setRecording(false);
    stopStream();
    onClose();
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-950 flex flex-col">
      {/* Camera preview */}
      <div className="relative flex-1 overflow-hidden bg-black">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className={`w-full h-full object-cover ${facing === 'user' ? 'scale-x-[-1]' : ''}`}
        />

        {!camOn && (
          <div className="absolute inset-0 bg-slate-950 flex flex-col items-center justify-center gap-2">
            <VideoOff className="w-12 h-12 text-slate-700" />
            <p className="text-xs text-slate-500 font-bold">Камера выключена</p>
          </div>
        )}

        {error && (
          <div className="absolute inset-0 bg-slate-950/95 flex flex-col items-center justify-center gap-3 px-8 text-center">
            <AlertCircle className="w-12 h-12 text-rose-400" />
            <p className="text-sm text-slate-200 font-bold">{error}</p>
            <button
              onClick={() => void startCamera(facing)}
              className="bg-emerald-500 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs active:scale-95 transition"
            >
              Повторить
            </button>
          </div>
        )}

        {/* Top overlay */}
        <div className="absolute top-0 inset-x-0 p-4 pt-safe flex items-start justify-between gap-2 bg-gradient-to-b from-slate-950/90 to-transparent">
          <div className="flex items-center gap-2">
            {recording ? (
              <span className="flex items-center gap-1.5 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> ЗАПИСЬ {mmss}
              </span>
            ) : (
              <span className="bg-slate-900/90 border border-slate-700 text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-lg">
                КАМЕРА ГОТОВА
              </span>
            )}
          </div>

          <button
            onClick={recording ? handleDiscard : onClose}
            className="p-2 bg-slate-950/80 border border-slate-700 text-slate-200 rounded-xl active:scale-90 transition"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950/95 to-transparent space-y-2">
          <p className="text-xs font-black text-white">{authorName}</p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {locationLabel}
          </p>
          {recording && (
            <p className="text-[11px] text-rose-300 font-bold">
              Идёт запись · по остановке запись можно опубликовать в ленту
            </p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 pb-safe space-y-3">
        {!recording && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название записи"
            className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() => toggleTrack('audio')}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition active:scale-90 ${
              micOn ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-rose-500/20 border-rose-500 text-rose-400'
            }`}
            aria-label="Микрофон"
          >
            {micOn ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
          </button>

          {recording ? (
            <button
              onClick={handleFinish}
              className="px-7 py-4 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-sm shadow-[0_0_25px_rgba(244,63,94,0.5)] active:scale-95 transition flex items-center gap-2"
            >
              <Square className="w-4 h-4 fill-white" /> Остановить
            </button>
          ) : (
            <button
              onClick={handleStartRecording}
              disabled={!!error}
              className="px-7 py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black rounded-2xl text-sm shadow-[0_0_25px_rgba(244,63,94,0.5)] active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Radio className="w-4 h-4" /> Начать запись
            </button>
          )}

          <button
            onClick={() => toggleTrack('video')}
            className={`w-12 h-12 rounded-full flex items-center justify-center border transition active:scale-90 ${
              camOn ? 'bg-slate-800 border-slate-700 text-slate-200' : 'bg-rose-500/20 border-rose-500 text-rose-400'
            }`}
            aria-label="Камера"
          >
            {camOn ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
          </button>
        </div>

        <button
          onClick={handleFlip}
          disabled={recording}
          className="w-full py-2.5 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-2xl text-xs active:scale-95 transition flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <SwitchCamera className="w-4 h-4" />
          {facing === 'user' ? 'Фронтальная камера' : 'Основная камера'}
        </button>

        <p className="text-[10px] text-slate-500 text-center leading-snug">
          Это запись видео, а не трансляция: после остановки добавьте подпись —
          публикация появится в ленте.
        </p>
      </div>
    </div>
  );
};
