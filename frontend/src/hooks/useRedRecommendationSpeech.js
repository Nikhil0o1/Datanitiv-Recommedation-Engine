import { useCallback } from 'react';
import { enqueueSpeech } from './speechQueue';

/**
 * Speaks red ("neg") recommendations for CAP plans as they become visible — on initial load
 * for already-open programs, and again every time a program is (re)opened, even if the same
 * cap-id was already spoken before. Returns a callback: reportVisible([{ capId, text }, ...]).
 */
export function useRedRecommendationSpeech() {
  return useCallback((items = []) => {
    const withText = items.filter((it) => it.text);
    if (!withText.length) return;
    console.log('[red-rec-speech] enqueuing', withText.map((it) => it.capId));
    enqueueSpeech(withText.map((it) => `For ${it.capId} — ${it.text}`).join(' '));
  }, []);
}
