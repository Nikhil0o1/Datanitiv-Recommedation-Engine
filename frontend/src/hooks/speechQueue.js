import { api } from '../api/client';

/** Shared, singleton speech queue — plays texts one after another via ElevenLabs TTS. */

let queue = [];
let playing = false;
let clicked = false;

function playNext() {
  if (playing || !queue.length) return;
  playing = true;
  const text = queue.shift();
  console.log('[speech-queue] speaking:', text);
  api
    .tts(text)
    .then((blob) => {
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.addEventListener('ended', () => {
        URL.revokeObjectURL(url);
        playing = false;
        playNext();
      });
      return audio.play();
    })
    .catch(() => {
      playing = false;
      playNext();
    });
}

/** Queue text for playback. Waits for the user's first click before playing anything
 *  (browsers block audio.play() without a prior user gesture). */
export function enqueueSpeech(text) {
  if (!text) return;
  console.log('[speech-queue] enqueued:', text);
  queue.push(text);
  if (clicked) playNext();
}

if (typeof document !== 'undefined') {
  document.addEventListener(
    'click',
    () => {
      clicked = true;
      playNext();
    },
    { once: true },
  );
}
