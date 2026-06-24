/**
 * useVoiceCommand — Custom React hook for Web Speech API
 * -------------------------------------------------------
 * Wraps SpeechRecognition into a clean interface.
 * Parses voice input into { action, target } command objects.
 */

import { useState, useRef, useCallback } from 'react';

// ── Device keyword map ───────────────────────────────────────────────────────
const DEVICE_KEYWORDS = {
  'light 1':   'light1',
  'light one': 'light1',
  'light1':    'light1',
  'first light': 'light1',
  'light 2':   'light2',
  'light two': 'light2',
  'light2':    'light2',
  'second light': 'light2',
  'fan':       'fan',
  'ac':        'ac',
  'air conditioner': 'ac',
  'air con':   'ac',
  'cooler':    'ac',
};

// ── Scene keyword map ────────────────────────────────────────────────────────
const SCENE_KEYWORDS = {
  'good morning': 'good_morning',
  'morning':      'good_morning',
  'wake up':      'good_morning',
  'movie night':  'movie_night',
  'movie':        'movie_night',
  'cinema':       'movie_night',
  'sleep':        'sleep_mode',
  'sleep mode':   'sleep_mode',
  'goodnight':    'sleep_mode',
  'good night':   'sleep_mode',
  'night mode':   'sleep_mode',
  'away':         'away',
  'leave':        'away',
  'leaving':      'away',
  'i am leaving': 'away',
};

/**
 * Parses a raw transcript string into a command object.
 * Returns one of:
 *   { type: 'device', deviceId, state: true|false }
 *   { type: 'scene',  sceneId }
 *   { type: 'master_off' }
 *   { type: 'unknown', raw }
 */
export function parseVoiceCommand(raw) {
  const text = raw.toLowerCase().trim();

  // Master off
  if (
    text.includes('everything off') ||
    text.includes('turn off everything') ||
    text.includes('all off') ||
    text.includes('master off') ||
    text.includes('turn off all')
  ) {
    return { type: 'master_off' };
  }

  // Master on
  if (
    text.includes('everything on') ||
    text.includes('turn on everything') ||
    text.includes('all on') ||
    text.includes('master on') ||
    text.includes('turn on all')
  ) {
    return { type: 'master_on' };
  }

  // Scene activation
  for (const [keyword, sceneId] of Object.entries(SCENE_KEYWORDS)) {
    if (text.includes(keyword)) {
      return { type: 'scene', sceneId };
    }
  }

  // Device on/off
  const isOn  = text.includes('turn on') || text.startsWith('on ') || text.endsWith(' on');
  const isOff = text.includes('turn off') || text.startsWith('off ') || text.endsWith(' off');

  if (isOn || isOff) {
    for (const [keyword, deviceId] of Object.entries(DEVICE_KEYWORDS)) {
      if (text.includes(keyword)) {
        return { type: 'device', deviceId, state: isOn };
      }
    }
  }

  return { type: 'unknown', raw };
}

// ── Hook ─────────────────────────────────────────────────────────────────────
export default function useVoiceCommand() {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript]   = useState('');
  const [lastCommand, setLastCommand] = useState(null);
  const recognitionRef = useRef(null);

  const supported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

  const startListening = useCallback((onCommand) => {
    if (!supported) return;
    if (isListening) return;

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event) => {
      const raw = event.results[0][0].transcript;
      setTranscript(raw);
      const command = parseVoiceCommand(raw);
      setLastCommand(command);
      if (onCommand) onCommand(command, raw);
    };

    recognition.onerror = (event) => {
      console.warn('[VoiceCommand] Error:', event.error);
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [supported, isListening]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  return { isListening, transcript, lastCommand, startListening, stopListening, supported };
}
