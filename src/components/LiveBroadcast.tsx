import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Radio, Video, VideoOff, Mic, MicOff, SwitchCamera,
  Users as UsersIcon, Heart, X, MapPin, AlertCircle
} from 'lucide-react';
import { triggerHapticImpact, triggerHapticNotification } from '../services/native';

interface LiveBroadcastProps {
  isOpen: boolean;
  onClose: () => void;
  authorName: string;
  locationLabel: string;
  onPublish: (title: string, durationSec: number, viewers: number) => void;
}

export const LiveBroadcast: React.FC<LiveBroadcastProps> = ({
  isOpen, onClose, authorName, locationLabel, onPublish
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [live, setLive] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [facing, setFacing] = useState<'user' | 'environment'>('environment');
  const [seconds, setSeconds] = useState(0);
  const [viewers, setViewers] = useState(0);
  const [hearts, setHearts] = useState(0);
  const [title, setTitle] = useState('Тренировка в прямом эфире');

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
    if (isOpen) startCamera(facing);
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // Broadcast timer + simulated audience growth
  useEffect(() => {
    if (!live) return;
    const timer = setInterval(() => {
      setSeconds((s) => s + 1);
      setViewers((v) => v + Math.floor(Math.random() * 3));
      if (Math.random() > 0.6) setHearts((h) => h + Math.floor(Math.random() * 4) + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [live]);

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
    startCamera(next);
  };

  const handleGoLive = () => {
    triggerHapticNotification('success');
    setLive(true);
    setViewers(Math.floor(Math.random() * 6) + 3);
  };

  const handleStop = () => {
    triggerHapticImpact('heavy');
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (seconds > 2) onPublish(title, seconds, viewers);
    setLive(false);
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
              onClick={() => startCamera(facing)}
              className="bg-emerald-500 text-slate-950 font-black px-5 py-2.5 rounded-2xl text-xs active:scale-95 transition"
            >
              Повторить
            </button>
          </div>
        )}

        {/* Top overlay */}
        <div className="absolute top-0 inset-x-0 p-4 pt-safe flex items-start justify-between gap-2 bg-gradient-to-b from-slate-950/90 to-transparent">
          <div className="flex items-center gap-2">
            {live ? (
              <span className="flex items-center gap-1.5 bg-rose-500 text-white text-[10px] font-black px-2.5 py-1 rounded-lg shadow-lg">
                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" /> LIVE {mmss}
              </span>
            ) : (
              <span className="bg-slate-900/90 border border-slate-700 text-slate-300 text-[10px] font-black px-2.5 py-1 rounded-lg">
                ПРЕДПРОСМОТР
              </span>
            )}
            {live && (
              <span className="flex items-center gap-1 bg-slate-950/80 border border-slate-700 text-slate-200 text-[10px] font-bold px-2 py-1 rounded-lg">
                <UsersIcon className="w-3 h-3 text-emerald-400" /> {viewers}
              </span>
            )}
          </div>

          <button
            onClick={live ? handleStop : onClose}
            className="p-2 bg-slate-950/80 border border-slate-700 text-slate-200 rounded-xl active:scale-90 transition"
            aria-label="Закрыть"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Floating hearts */}
        {live && hearts > 0 && (
          <div className="absolute bottom-28 right-4 pointer-events-none">
            <motion.div
              key={hearts}
              initial={{ opacity: 1, y: 0, scale: 0.6 }}
              animate={{ opacity: 0, y: -110, scale: 1.25 }}
              transition={{ duration: 1.8 }}
            >
              <Heart className="w-7 h-7 fill-rose-500 text-rose-500" />
            </motion.div>
          </div>
        )}

        {/* Bottom info */}
        <div className="absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-slate-950/95 to-transparent space-y-2">
          <p className="text-xs font-black text-white">{authorName}</p>
          <p className="text-[11px] text-emerald-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {locationLabel}
          </p>
          {live && hearts > 0 && (
            <p className="text-[11px] text-rose-300 font-bold">❤️ {hearts} реакций</p>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="bg-slate-900 border-t border-slate-800 p-4 pb-safe space-y-3">
        {!live && (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Название трансляции"
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

          {live ? (
            <button
              onClick={handleStop}
              className="px-7 py-4 bg-rose-500 hover:bg-rose-400 text-white font-black rounded-2xl text-sm shadow-[0_0_25px_rgba(244,63,94,0.5)] active:scale-95 transition"
            >
              Завершить эфир
            </button>
          ) : (
            <button
              onClick={handleGoLive}
              disabled={!!error}
              className="px-7 py-4 bg-gradient-to-r from-rose-500 to-rose-600 text-white font-black rounded-2xl text-sm shadow-[0_0_25px_rgba(244,63,94,0.5)] active:scale-95 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Radio className="w-4 h-4" /> Начать эфир
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
          className="w-full py-2.5 bg-slate-950 border border-slate-800 text-slate-300 font-bold rounded-2xl text-xs active:scale-95 transition flex items-center justify-center gap-2"
        >
          <SwitchCamera className="w-4 h-4" />
          {facing === 'user' ? 'Фронтальная камера' : 'Основная камера'}
        </button>
      </div>
    </div>
  );
};
