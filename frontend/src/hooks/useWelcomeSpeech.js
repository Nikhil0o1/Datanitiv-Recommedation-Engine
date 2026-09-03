import { useEffect, useRef } from 'react';
import { enqueueSpeech } from './speechQueue';
import { WELCOME_SESSION_KEY, buildWelcomeMessage } from '../utils/welcomeMessage';

/**
 * Minimal, standalone welcome speech: queued once per browser session (sessionStorage-gated).
 * Actual playback (and waiting for the user's first click, since browsers block autoplay
 * without one) is handled by the shared `speechQueue`.
 */
export function useWelcomeSpeech({ enabled, cycleLabel, triage }) {
  const startedRef = useRef(false);

  useEffect(() => {
    console.log('[welcome-speech] effect run — enabled:', enabled, 'started:', startedRef.current);
    if (!enabled || startedRef.current) return;
    startedRef.current = true;

    try {
      if (sessionStorage.getItem(WELCOME_SESSION_KEY)) {
        console.log('[welcome-speech] already shown this session — skipping');
        return;
      }
    } catch {
      /* private browsing — sessionStorage unavailable, skip gating */
    }

    const text = buildWelcomeMessage({
      cycleLabel,
      dec: triage?.dec || [],
      auto: triage?.auto || [],
      quiet: triage?.quiet || [],
      counts: triage?.counts || {},
    });

    console.log('[welcome-speech] enqueued');
    enqueueSpeech(text);
    try {
      sessionStorage.setItem(WELCOME_SESSION_KEY, '1');
    } catch {
      /* ignore */
    }
  }, [enabled, cycleLabel, triage]);
}
