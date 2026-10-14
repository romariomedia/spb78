import { useEffect, useRef, type MouseEvent, type TouchEvent } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createBackStack, MOBILE_TABS, swipeStep } from '../../shared/mobile-navigation.js';
import type { TabType } from '../lib/types';

export const backLayers = createBackStack();
export function useBackLayer(open: boolean, close: () => void) {
  const latest = useRef(close);
  latest.current = close;
  useEffect(() => open ? backLayers.add(() => latest.current()) : undefined, [open]);
}

export function useMobileNavigation(tab: TabType, change: (tab: TabType) => void, back: () => boolean, blocked: boolean) {
  const latest = useRef({ tab, change, back, blocked });
  latest.current = { tab, change, back, blocked };
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return;
    const listener = App.addListener('backButton', () => {
      const focused = document.activeElement;
      if (focused instanceof HTMLElement && focused.matches('input,textarea,[contenteditable="true"]')) {
        focused.blur();
        return;
      }
      if (backLayers.closeTop() || latest.current.back()) return;
      void App.minimizeApp();
    });
    return () => { void listener.then(handle => handle.remove()); };
  }, []);
  const start = useRef<{ x: number; y: number; time: number } | null>(null);
  const suppressClickUntil = useRef(0);
  const cancel = () => { start.current = null; };
  return {
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (performance.now() < suppressClickUntil.current) { event.preventDefault(); event.stopPropagation(); }
    },
    onTouchStart(event: TouchEvent<HTMLElement>) {
      cancel();
      if (event.touches.length !== 1 || window.innerWidth >= 768 || latest.current.blocked || backLayers.hasLayers()) return;
      const target = event.target as HTMLElement;
      if (target.closest('button,a,input,textarea,select,[contenteditable],.leaflet-container,[data-no-tab-swipe],dialog,[role="dialog"]')) return;
      for (let node: HTMLElement | null = target; node && node !== event.currentTarget; node = node.parentElement) {
        if (node.scrollWidth > node.clientWidth + 4 && /auto|scroll/.test(getComputedStyle(node).overflowX)) return;
      }
      const point = event.touches[0]!;
      // Leave Android's edge Back gesture to the OS.
      if (point.clientX < 24 || point.clientX > window.innerWidth - 24) return;
      start.current = { x: point.clientX, y: point.clientY, time: performance.now() };
    },
    onTouchMove(event: TouchEvent<HTMLElement>) {
      const point = event.touches[0];
      if (event.touches.length !== 1 || (point && start.current && Math.abs(point.clientY - start.current.y) > 28)) cancel();
    },
    onTouchCancel: cancel,
    onTouchEnd(event: TouchEvent<HTMLElement>) {
      const origin = start.current; cancel();
      const point = event.changedTouches[0];
      if (!origin || !point || latest.current.blocked || backLayers.hasLayers()) return;
      const step = swipeStep(point.clientX - origin.x, point.clientY - origin.y, performance.now() - origin.time);
      if (!step) return;
      const next = MOBILE_TABS[MOBILE_TABS.indexOf(latest.current.tab) + step];
      if (next) { suppressClickUntil.current = performance.now() + 400; latest.current.change(next); }
    }
  };
}
