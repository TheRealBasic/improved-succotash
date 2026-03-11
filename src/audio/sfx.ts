export type SfxEventType = 'place' | 'connect' | 'error' | 'start' | 'stop';

type SfxSettings = {
  volume: number;
  muted: boolean;
};

type SfxSubscriber = (settings: SfxSettings) => void;

const STORAGE_KEY = 'circuit-workbench-sfx-settings';
const DEFAULT_SETTINGS: SfxSettings = {
  volume: 0.45,
  muted: false
};

const subscribers = new Set<SfxSubscriber>();

let settings: SfxSettings = DEFAULT_SETTINGS;
let audioContext: AudioContext | null = null;
let preloadedBuffers: Map<SfxEventType, AudioBuffer> | null = null;
let blockedByAutoplay = false;

const envelope = (gain: GainNode, startTime: number, peak: number, duration: number) => {
  gain.gain.setValueAtTime(0.0001, startTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(peak, 0.0001), startTime + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
};

const readStoredSettings = (): SfxSettings => {
  if (typeof window === 'undefined') {
    return DEFAULT_SETTINGS;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return DEFAULT_SETTINGS;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<SfxSettings>;
    return {
      volume: typeof parsed.volume === 'number' ? Math.min(1, Math.max(0, parsed.volume)) : DEFAULT_SETTINGS.volume,
      muted: typeof parsed.muted === 'boolean' ? parsed.muted : DEFAULT_SETTINGS.muted
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
};

const writeStoredSettings = () => {
  if (typeof window === 'undefined') {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
};

const emitSettings = () => {
  subscribers.forEach((subscriber) => subscriber(settings));
};

const createBuffer = (context: AudioContext, eventType: SfxEventType): AudioBuffer => {
  const sampleRate = context.sampleRate;
  const duration = eventType === 'error' ? 0.2 : 0.16;
  const frameCount = Math.floor(sampleRate * duration);
  const buffer = context.createBuffer(1, frameCount, sampleRate);
  const channel = buffer.getChannelData(0);

  for (let i = 0; i < frameCount; i += 1) {
    const t = i / sampleRate;
    const progress = t / duration;
    let base = 220;

    switch (eventType) {
      case 'place':
        base = 440 + 100 * (1 - progress);
        break;
      case 'connect':
        base = 320 + 220 * progress;
        break;
      case 'error':
        base = 180 - 60 * progress;
        break;
      case 'start':
        base = 240 + 280 * progress;
        break;
      case 'stop':
        base = 520 - 240 * progress;
        break;
    }

    const wave = Math.sin(2 * Math.PI * base * t);
    const harmonics = 0.35 * Math.sin(2 * Math.PI * base * 2 * t);
    const shape = Math.exp(-7 * progress);
    channel[i] = (wave + harmonics) * shape;
  }

  return buffer;
};

const getOrCreateContext = (): AudioContext | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const ContextCtor = window.AudioContext ?? (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!ContextCtor) {
    return null;
  }

  if (!audioContext) {
    audioContext = new ContextCtor();
  }

  return audioContext;
};

const preloadBuffers = (context: AudioContext): Map<SfxEventType, AudioBuffer> => {
  if (preloadedBuffers) {
    return preloadedBuffers;
  }

  preloadedBuffers = new Map<SfxEventType, AudioBuffer>();
  (['place', 'connect', 'error', 'start', 'stop'] as const).forEach((eventType) => {
    preloadedBuffers?.set(eventType, createBuffer(context, eventType));
  });

  return preloadedBuffers;
};

export const primeSfx = (): void => {
  settings = readStoredSettings();
  const context = getOrCreateContext();
  if (!context) {
    return;
  }

  preloadBuffers(context);
};

export const unlockSfx = async (): Promise<boolean> => {
  const context = getOrCreateContext();
  if (!context) {
    return false;
  }

  preloadBuffers(context);

  if (context.state === 'running') {
    blockedByAutoplay = false;
    return true;
  }

  try {
    await context.resume();
    blockedByAutoplay = false;
    return true;
  } catch {
    blockedByAutoplay = true;
    return false;
  }
};

export const isSfxBlocked = (): boolean => blockedByAutoplay;

export const getSfxSettings = (): SfxSettings => settings;

export const subscribeToSfxSettings = (subscriber: SfxSubscriber): (() => void) => {
  subscribers.add(subscriber);
  subscriber(settings);
  return () => subscribers.delete(subscriber);
};

export const setSfxVolume = (volume: number): void => {
  settings = { ...settings, volume: Math.min(1, Math.max(0, volume)) };
  writeStoredSettings();
  emitSettings();
};

export const toggleSfxMute = (): void => {
  settings = { ...settings, muted: !settings.muted };
  writeStoredSettings();
  emitSettings();
};

export const playSfx = (eventType: SfxEventType): void => {
  if (settings.muted || settings.volume <= 0) {
    return;
  }

  const context = getOrCreateContext();
  if (!context) {
    return;
  }

  preloadBuffers(context);

  if (context.state !== 'running') {
    blockedByAutoplay = true;
    return;
  }

  const buffer = preloadedBuffers?.get(eventType);
  if (!buffer) {
    return;
  }

  const source = context.createBufferSource();
  source.buffer = buffer;

  const gain = context.createGain();
  const startTime = context.currentTime;
  envelope(gain, startTime, settings.volume, buffer.duration);

  source.connect(gain);
  gain.connect(context.destination);
  source.start(startTime);
};

primeSfx();
