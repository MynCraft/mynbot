import { ref } from 'vue';

export interface MusicTrackInfo {
  id: string;
  title: string;
  author?: string;
  downloaded?: boolean;
  size?: number;
  url?: string;
  [key: string]: any;
}

export interface MusicCatalogState {
  tracks: MusicTrackInfo[];
  downloadedCount: number;
  totalCount: number;
  downloading: boolean;
}

export const MUSIC_TRACKS = [
  'Sweden (Calm)',
  'Subwoofer Lullaby',
  'Living Mice',
  'Wet Hands',
] as const;

export const currentTrackIndex = ref<number>(0);
export const currentTrackName = ref<string>('Sweden (Calm)');
export const shuffleEnabled = ref<boolean>(true);

export const musicMuted = ref<boolean>(
  typeof localStorage !== 'undefined' && localStorage.getItem('mynbot_music_muted') === '1'
);
export const musicPlaying = ref<boolean>(false);

export const musicCatalogState = ref<MusicCatalogState>({
  tracks: [],
  downloadedCount: 0,
  totalCount: 0,
  downloading: false,
});

export let shuffledQueue: MusicTrackInfo[] = [];
export let audioEl: HTMLAudioElement | null = null;
let currentBlobUrl: string | null = null;
let playToken = 0;
let lastTrackId: string | undefined;

interface NoteEvent {
  time: number; // saniye
  duration: number; // saniye
  notes: string[]; // örn: ['D3', 'F#4', 'A4']
  velocity?: number; // 0.0 - 1.0
}

interface Track {
  name: string;
  duration: number;
  events: NoteEvent[];
}

const SEMITONES: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
};

function noteToFreq(note: string): number {
  const match = note.trim().match(/^([A-Ga-g][#b]?)(-?\d+)$/);
  if (!match) return 440;
  const name = match[1].charAt(0).toUpperCase() + match[1].slice(1);
  const octave = parseInt(match[2], 10);
  const semitone = SEMITONES[name] ?? 9;
  const midi = 12 * (octave + 1) + semitone;
  return 440 * Math.pow(2, (midi - 69) / 12);
}

// 4 adet C418 esintili sıcak, huzurlu Minecraft bestesi
export const TRACKS: Track[] = [
  {
    name: 'Sweden (Calm)',
    duration: 34,
    events: [
      // Bölüm 1 - D Major / F#m / G
      { time: 0.0, duration: 3.5, notes: ['D3', 'A3', 'F#4'], velocity: 0.55 },
      { time: 1.6, duration: 2.8, notes: ['A4'], velocity: 0.5 },
      { time: 3.2, duration: 3.6, notes: ['D5'], velocity: 0.55 },
      { time: 5.0, duration: 3.0, notes: ['F#2', 'C#3', 'C#5'], velocity: 0.5 },
      { time: 6.8, duration: 2.8, notes: ['A4'], velocity: 0.48 },
      { time: 8.4, duration: 3.8, notes: ['F#4'], velocity: 0.52 },
      { time: 10.4, duration: 3.6, notes: ['G2', 'D3', 'B4'], velocity: 0.55 },
      { time: 12.0, duration: 2.8, notes: ['D5'], velocity: 0.5 },
      { time: 13.8, duration: 3.2, notes: ['B4'], velocity: 0.48 },
      { time: 15.6, duration: 3.8, notes: ['A4', 'F#3'], velocity: 0.52 },

      // Bölüm 2 - Bm / G / A / D
      { time: 18.0, duration: 3.6, notes: ['B2', 'F#3', 'D4', 'F#4'], velocity: 0.55 },
      { time: 19.8, duration: 2.8, notes: ['A4'], velocity: 0.5 },
      { time: 21.4, duration: 3.4, notes: ['D5'], velocity: 0.56 },
      { time: 23.2, duration: 3.6, notes: ['G2', 'D3', 'B4'], velocity: 0.52 },
      { time: 25.0, duration: 2.8, notes: ['A4'], velocity: 0.48 },
      { time: 26.8, duration: 3.8, notes: ['A2', 'E3', 'C#4', 'E4'], velocity: 0.5 },
      { time: 29.0, duration: 4.8, notes: ['D3', 'A3', 'F#4', 'D5'], velocity: 0.58 },
    ],
  },
  {
    name: 'Subwoofer Lullaby',
    duration: 30,
    events: [
      // Rüya gibi ninni melodisi
      { time: 0.0, duration: 3.5, notes: ['C3', 'G3', 'C4'], velocity: 0.52 },
      { time: 1.6, duration: 2.8, notes: ['E4'], velocity: 0.48 },
      { time: 3.0, duration: 3.0, notes: ['G4'], velocity: 0.5 },
      { time: 4.6, duration: 3.5, notes: ['B3', 'G3', 'B4'], velocity: 0.52 },
      { time: 6.4, duration: 2.8, notes: ['A4'], velocity: 0.48 },
      { time: 8.0, duration: 3.6, notes: ['A2', 'E3', 'C4'], velocity: 0.5 },
      { time: 9.8, duration: 2.8, notes: ['E4'], velocity: 0.48 },
      { time: 11.4, duration: 3.2, notes: ['G4'], velocity: 0.5 },
      { time: 13.2, duration: 3.6, notes: ['F2', 'C3', 'F4'], velocity: 0.54 },
      { time: 15.0, duration: 3.0, notes: ['E4'], velocity: 0.48 },
      { time: 16.8, duration: 3.0, notes: ['D4'], velocity: 0.46 },
      { time: 18.8, duration: 3.8, notes: ['G2', 'D3', 'B3', 'D4'], velocity: 0.5 },
      { time: 21.2, duration: 2.8, notes: ['E4'], velocity: 0.48 },
      { time: 23.0, duration: 5.5, notes: ['C3', 'G3', 'E4', 'G4', 'C5'], velocity: 0.58 },
    ],
  },
  {
    name: 'Living Mice',
    duration: 32,
    events: [
      // Melankolik ve sakin atmosfer
      { time: 0.0, duration: 3.6, notes: ['E2', 'B2', 'G3', 'E4'], velocity: 0.54 },
      { time: 1.8, duration: 2.8, notes: ['G4'], velocity: 0.5 },
      { time: 3.4, duration: 3.4, notes: ['B4'], velocity: 0.52 },
      { time: 5.2, duration: 3.6, notes: ['C3', 'G3', 'D5'], velocity: 0.55 },
      { time: 7.0, duration: 2.8, notes: ['C5'], velocity: 0.5 },
      { time: 8.8, duration: 3.2, notes: ['B4'], velocity: 0.48 },
      { time: 10.6, duration: 3.6, notes: ['G2', 'D3', 'G4'], velocity: 0.52 },
      { time: 12.4, duration: 2.8, notes: ['E4'], velocity: 0.48 },
      { time: 14.2, duration: 3.2, notes: ['F#4'], velocity: 0.5 },
      { time: 16.2, duration: 3.8, notes: ['D3', 'A3', 'A4'], velocity: 0.54 },
      { time: 18.2, duration: 3.0, notes: ['D5'], velocity: 0.52 },
      { time: 20.2, duration: 3.6, notes: ['B2', 'F#3', 'B4'], velocity: 0.5 },
      { time: 22.4, duration: 3.2, notes: ['G4'], velocity: 0.48 },
      { time: 24.6, duration: 5.5, notes: ['E2', 'B2', 'E3', 'G3', 'B3', 'E4'], velocity: 0.58 },
    ],
  },
  {
    name: 'Wet Hands',
    duration: 32,
    events: [
      // Huzurlu piyano arpejleri & akorlar
      { time: 0.0, duration: 3.2, notes: ['A2', 'E3', 'A4'], velocity: 0.55 },
      { time: 1.4, duration: 2.6, notes: ['G4'], velocity: 0.5 },
      { time: 2.6, duration: 2.6, notes: ['E4'], velocity: 0.48 },
      { time: 4.0, duration: 3.6, notes: ['F2', 'C3', 'D4'], velocity: 0.54 },
      { time: 5.6, duration: 2.8, notes: ['C4'], velocity: 0.5 },
      { time: 7.0, duration: 2.8, notes: ['E4'], velocity: 0.48 },
      { time: 8.6, duration: 3.8, notes: ['C3', 'G3', 'G4'], velocity: 0.56 },
      { time: 10.2, duration: 2.8, notes: ['A4'], velocity: 0.5 },
      { time: 11.8, duration: 3.0, notes: ['B4'], velocity: 0.52 },
      { time: 13.6, duration: 3.6, notes: ['G2', 'D3', 'C5'], velocity: 0.55 },
      { time: 15.4, duration: 2.8, notes: ['B4'], velocity: 0.48 },
      { time: 17.0, duration: 3.0, notes: ['G4'], velocity: 0.48 },
      { time: 19.0, duration: 3.8, notes: ['F2', 'C3', 'A4'], velocity: 0.54 },
      { time: 21.0, duration: 3.0, notes: ['E4'], velocity: 0.48 },
      { time: 23.0, duration: 3.6, notes: ['G4'], velocity: 0.5 },
      { time: 25.4, duration: 5.5, notes: ['C3', 'G3', 'C4', 'E4'], velocity: 0.58 },
    ],
  },
];

export let chordIndex = 0;
let loopTimer: number | null = null;
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let delayNode: DelayNode | null = null;
let delayFeedback: GainNode | null = null;
let delayFilter: BiquadFilterNode | null = null;
let activeNodes: AudioScheduledSourceNode[] = [];
let autoStartInitialized = false;
let onChangeRegistered = false;
let awaitingGestureResume = false;
let lastCatalogSyncAt = 0;

function attachGestureResume(): void {
  if (typeof window === 'undefined') return;
  const resumeOnGesture = () => {
    window.removeEventListener('pointerdown', resumeOnGesture);
    window.removeEventListener('keydown', resumeOnGesture);
    if (!awaitingGestureResume || musicMuted.value || !musicPlaying.value) return;
    awaitingGestureResume = false;
    if (audioCtx && audioCtx.state === 'suspended') {
      void audioCtx.resume().catch(() => {});
    }
    if (audioEl && audioEl.src && audioEl.paused) {
      void audioEl.play().catch(() => {
        playToken++;
        void playNextShuffledRealTrack(playToken);
      });
    }
  };
  window.addEventListener('pointerdown', resumeOnGesture, { once: true });
  window.addEventListener('keydown', resumeOnGesture, { once: true });
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    audioCtx = new AudioContextClass();

    // Master Gain
    masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0.24, audioCtx.currentTime);

    // Uzaysal Ambiyans Yankısı (Reverb / Delay hattı)
    delayNode = audioCtx.createDelay(1.5);
    delayNode.delayTime.setValueAtTime(0.38, audioCtx.currentTime);

    delayFeedback = audioCtx.createGain();
    delayFeedback.gain.setValueAtTime(0.42, audioCtx.currentTime);

    delayFilter = audioCtx.createBiquadFilter();
    delayFilter.type = 'lowpass';
    delayFilter.frequency.setValueAtTime(850, audioCtx.currentTime);

    // Gecikme döngüsü: delay -> filter -> feedback -> delay
    delayNode.connect(delayFilter);
    delayFilter.connect(delayFeedback);
    delayFeedback.connect(delayNode);

    // Delay çıkışını master'a bağla
    delayNode.connect(masterGain);

    // Master'ı hoparlöre bağla
    masterGain.connect(audioCtx.destination);
  }

  if (audioCtx.state === 'suspended' && !musicMuted.value) {
    audioCtx.resume().catch(() => {});
  }

  return audioCtx;
}

export function playPianoNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number = 0.5
): void {
  if (!masterGain || !delayNode) return;

  const now = Math.max(ctx.currentTime, startTime);
  const noteDuration = Math.max(1.8, duration);

  const noteGain = ctx.createGain();
  const peakVol = Math.min(0.28, Math.max(0.04, velocity * 0.26));
  noteGain.gain.setValueAtTime(0.0001, now);
  noteGain.gain.linearRampToValueAtTime(peakVol, now + 0.045);
  noteGain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(950, now);
  filter.frequency.exponentialRampToValueAtTime(380, now + noteDuration);
  filter.Q.setValueAtTime(1.1, now);

  const oscMain = ctx.createOscillator();
  oscMain.type = 'triangle';
  oscMain.frequency.setValueAtTime(freq, now);

  const oscWarmth = ctx.createOscillator();
  oscWarmth.type = 'sine';
  oscWarmth.frequency.setValueAtTime(freq, now);
  oscWarmth.detune.setValueAtTime(4, now);

  oscMain.connect(filter);
  oscWarmth.connect(filter);
  filter.connect(noteGain);

  noteGain.connect(masterGain);
  const sendGain = ctx.createGain();
  sendGain.gain.setValueAtTime(0.32, now);
  noteGain.connect(sendGain);
  sendGain.connect(delayNode);

  try {
    oscMain.start(now);
    oscWarmth.start(now);
    oscMain.stop(now + noteDuration);
    oscWarmth.stop(now + noteDuration);

    activeNodes.push(oscMain, oscWarmth);

    oscMain.onended = () => {
      const idx = activeNodes.indexOf(oscMain);
      if (idx !== -1) activeNodes.splice(idx, 1);
    };
    oscWarmth.onended = () => {
      const idx = activeNodes.indexOf(oscWarmth);
      if (idx !== -1) activeNodes.splice(idx, 1);
    };
  } catch {}
}

export function playSubBass(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number = 0.5
): void {
  if (!masterGain) return;

  const now = Math.max(ctx.currentTime, startTime);
  const noteDuration = Math.max(2.0, duration);

  const bassGain = ctx.createGain();
  const peakVol = Math.min(0.18, Math.max(0.03, velocity * 0.16));
  bassGain.gain.setValueAtTime(0.0001, now);
  bassGain.gain.linearRampToValueAtTime(peakVol, now + 0.08);
  bassGain.gain.exponentialRampToValueAtTime(0.0001, now + noteDuration);

  const oscSub = ctx.createOscillator();
  oscSub.type = 'sine';
  oscSub.frequency.setValueAtTime(freq * 0.5, now);

  oscSub.connect(bassGain);
  bassGain.connect(masterGain);

  try {
    oscSub.start(now);
    oscSub.stop(now + noteDuration);

    activeNodes.push(oscSub);

    oscSub.onended = () => {
      const idx = activeNodes.indexOf(oscSub);
      if (idx !== -1) activeNodes.splice(idx, 1);
    };
  } catch {}
}

export function playFeltNote(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  velocity: number = 0.5
): void {
  playPianoNote(ctx, freq, startTime, duration, velocity);
  playSubBass(ctx, freq, startTime, duration, velocity);
}

export function refillShuffleQueue(tracks: MusicTrackInfo[], avoidId?: string): void {
  if (!tracks || tracks.length === 0) {
    shuffledQueue = [];
    return;
  }
  const copy = [...tracks];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  if (copy.length > 1 && avoidId && copy[0].id === avoidId) {
    const swapIdx = 1 + Math.floor(Math.random() * (copy.length - 1));
    [copy[0], copy[swapIdx]] = [copy[swapIdx], copy[0]];
  }
  shuffledQueue = copy;
}

export function formatTrackDisplay(track: MusicTrackInfo): string {
  return track.author && track.author !== 'Minecraft'
    ? `${track.author} — ${track.title}`
    : track.title;
}

export function stopSynthOnly(): void {
  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }
  for (const node of activeNodes) {
    try {
      node.stop();
      node.disconnect();
    } catch {}
  }
  activeNodes = [];

  if (masterGain && audioCtx) {
    masterGain.gain.cancelScheduledValues(audioCtx.currentTime);
    masterGain.gain.setValueAtTime(0.0001, audioCtx.currentTime);
  }
  if (delayFeedback && audioCtx) {
    delayFeedback.gain.cancelScheduledValues(audioCtx.currentTime);
    delayFeedback.gain.setValueAtTime(0, audioCtx.currentTime);
  }
  if (audioCtx && audioCtx.state === 'running') {
    void audioCtx.suspend().catch(() => {});
  }
}

export function stopAudioElement(): void {
  if (audioEl) {
    audioEl.onended = null;
    audioEl.onerror = null;
    try {
      audioEl.pause();
      audioEl.removeAttribute('src');
      audioEl.load();
    } catch {}
  }
  if (currentBlobUrl) {
    try {
      URL.revokeObjectURL(currentBlobUrl);
    } catch {}
    currentBlobUrl = null;
  }
}

function pickRandomSynthTrack(): void {
  if (TRACKS.length > 1) {
    let nextIdx = Math.floor(Math.random() * TRACKS.length);
    if (nextIdx === currentTrackIndex.value) {
      nextIdx = (nextIdx + 1) % TRACKS.length;
    }
    currentTrackIndex.value = nextIdx;
  } else {
    currentTrackIndex.value = 0;
  }
  currentTrackName.value = TRACKS[currentTrackIndex.value].name;
}

export function scheduleCurrentTrack(): void {
  const ctx = getAudioContext();
  if (!ctx || !musicPlaying.value || musicMuted.value) return;

  if (ctx.state === 'suspended') {
    awaitingGestureResume = true;
    attachGestureResume();
    void ctx.resume().then(() => {
      if (ctx.state === 'running') awaitingGestureResume = false;
    }).catch(() => {});
  }
  if (masterGain) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.setValueAtTime(0.24, ctx.currentTime);
  }
  if (delayFeedback) {
    delayFeedback.gain.cancelScheduledValues(ctx.currentTime);
    delayFeedback.gain.setValueAtTime(0.42, ctx.currentTime);
  }

  if (loopTimer) {
    clearTimeout(loopTimer);
    loopTimer = null;
  }

  const track = TRACKS[currentTrackIndex.value % TRACKS.length];
  const trackStart = ctx.currentTime + 0.1;

  for (const ev of track.events) {
    const evTime = trackStart + ev.time;
    for (const noteStr of ev.notes) {
      const freq = noteToFreq(noteStr);
      playFeltNote(ctx, freq, evTime, ev.duration, ev.velocity ?? 0.5);
    }
  }

  // Parça bitince kısa bir nefes boşluğu (3.2 saniye) bırakıp sıradaki parçaya geç
  const nextTrackDelayMs = (track.duration + 3.2) * 1000;
  loopTimer = window.setTimeout(() => {
    if (musicPlaying.value && !musicMuted.value) {
      playToken++;
      void playNextShuffledRealTrack(playToken);
    }
  }, nextTrackDelayMs);
}

function playShuffledSynthFallback(): void {
  pickRandomSynthTrack();
  scheduleCurrentTrack();
}

export async function syncMusicCatalog(): Promise<void> {
  if (typeof window === 'undefined') return;
  const api = (window as any).electronAPI;
  if (api && typeof api.getMusicState === 'function') {
    try {
      const state: MusicCatalogState = await api.getMusicState();
      if (state && Array.isArray(state.tracks)) {
        musicCatalogState.value = state;
        if (state.tracks.length > 0 && shuffledQueue.length === 0) {
          refillShuffleQueue(state.tracks, lastTrackId);
          if (shuffledQueue[0]?.id && typeof api.startMusicDownload === 'function') {
            void api.startMusicDownload(shuffledQueue[0].id);
          }
        }
      }
    } catch (err) {
      console.warn('Failed to sync music catalog:', err);
    }
  }
}

export async function playNextShuffledRealTrack(token: number): Promise<void> {
  await syncMusicCatalog();
  if (token !== playToken || musicMuted.value || !musicPlaying.value) {
    return;
  }

  const api = typeof window !== 'undefined' ? (window as any).electronAPI : undefined;

  if (api && typeof api.getMusicTrackBytes === 'function' && musicCatalogState.value.tracks.length > 0) {
    if (shuffledQueue.length === 0) {
      refillShuffleQueue(musicCatalogState.value.tracks, lastTrackId);
    }
    const track = shuffledQueue.shift();
    if (!track) {
      playShuffledSynthFallback();
      return;
    }
    lastTrackId = track.id;
    currentTrackName.value = formatTrackDisplay(track);

    // Also kick off synth briefly ONLY if no audioEl is currently playing and !track.downloaded, so music begins instantly while track #1 downloads over HTTP!
    const isAudioPlaying = Boolean(audioEl && !audioEl.paused && audioEl.currentTime > 0);
    if (!isAudioPlaying && !track.downloaded) {
      playShuffledSynthFallback();
      currentTrackName.value = formatTrackDisplay(track);
    }

    try {
      const bytes = await api.getMusicTrackBytes(track.id);
      if (token !== playToken || musicMuted.value || !musicPlaying.value) {
        return;
      }
      const hasBytes = bytes && (
        (typeof (bytes as any).byteLength === 'number' && (bytes as any).byteLength > 0) ||
        (typeof (bytes as any).length === 'number' && (bytes as any).length > 0)
      );

      if (hasBytes) {
        stopSynthOnly();
        const blob = new Blob([bytes as BlobPart], { type: 'audio/ogg' });
        if (currentBlobUrl) {
          try {
            URL.revokeObjectURL(currentBlobUrl);
          } catch {}
        }
        currentBlobUrl = URL.createObjectURL(blob);
        if (!audioEl) {
          audioEl = new Audio();
        }
        audioEl.volume = 0.28;
        audioEl.src = currentBlobUrl;
        audioEl.onended = () => {
          if (musicPlaying.value && !musicMuted.value) {
            playToken++;
            void playNextShuffledRealTrack(playToken);
          }
        };
        audioEl.onerror = () => {
          if (musicPlaying.value && !musicMuted.value) {
            playToken++;
            void playNextShuffledRealTrack(playToken);
          }
        };
        await audioEl.play().catch(() => {
          if (musicPlaying.value && !musicMuted.value) {
            awaitingGestureResume = true;
            attachGestureResume();
          }
        });
        return;
      }
    } catch (err) {
      console.warn('Failed to load real track bytes:', err);
      if (token !== playToken || musicMuted.value || !musicPlaying.value) {
        return;
      }
    }
  }

  // Fallback if offline or electronAPI missing: run shuffled synth
  playShuffledSynthFallback();
}

export function startMusic(): void {
  if (musicMuted.value) {
    return;
  }
  const token = ++playToken;
  musicPlaying.value = true;
  void playNextShuffledRealTrack(token);
}

export function stopMusic(): void {
  playToken++;
  awaitingGestureResume = false;
  musicPlaying.value = false;
  stopAudioElement();
  stopSynthOnly();
}

export function toggleMusic(): boolean {
  if (!musicMuted.value) {
    musicMuted.value = true;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mynbot_music_muted', '1');
    }
    stopMusic();
  } else {
    musicMuted.value = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mynbot_music_muted', '0');
    }
    startMusic();
  }
  return !musicMuted.value;
}

export function nextMusicTrack(): void {
  playToken++;
  if (musicMuted.value) {
    musicMuted.value = false;
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('mynbot_music_muted', '0');
    }
  }
  stopAudioElement();
  stopSynthOnly();
  musicPlaying.value = true;
  void playNextShuffledRealTrack(playToken);
}

export const nextTrack = nextMusicTrack;

export function initMusicAutoStart(): void {
  if (typeof window === 'undefined') return;

  const api = (window as any).electronAPI;
  if (!onChangeRegistered && api && typeof api.onChange === 'function') {
    onChangeRegistered = true;
    api.onChange(() => {
      const cur = musicCatalogState.value;
      if (cur.totalCount > 0 && cur.downloadedCount >= cur.totalCount && !cur.downloading) {
        return;
      }
      const now = Date.now();
      if (now - lastCatalogSyncAt < 350) {
        return;
      }
      lastCatalogSyncAt = now;
      if (typeof api.getMusicState === 'function') {
        void api.getMusicState().then((state: MusicCatalogState) => {
          if (state && Array.isArray(state.tracks)) {
            musicCatalogState.value = state;
          }
        }).catch(() => {});
      }
    });
  }

  void syncMusicCatalog();

  if (autoStartInitialized) return;
  autoStartInitialized = true;

  if (musicMuted.value) {
    musicPlaying.value = false;
    return;
  }

  const triggerStart = () => {
    window.removeEventListener('pointerdown', triggerStart);
    window.removeEventListener('keydown', triggerStart);
    if (musicMuted.value) return;
    if (!musicPlaying.value) {
      startMusic();
    }
  };

  // Autoplay engeli olan ortamlarda ilk etkileşimde hemen müziği başlat
  window.addEventListener('pointerdown', triggerStart, { once: true });
  window.addEventListener('keydown', triggerStart, { once: true });

  // Eğer doğrudan çalabiliyorsa hemen başlatmayı dene
  try {
    startMusic();
  } catch {
    // Pointerdown ile tetiklenecek
  }
}

export function useMinecraftMusic() {
  return {
    musicPlaying,
    musicMuted,
    shuffleEnabled,
    currentTrackIndex,
    currentTrackName,
    musicCatalogState,
    startMusic,
    stopMusic,
    toggleMusic,
    nextTrack,
    nextMusicTrack,
    initMusicAutoStart,
    syncMusicCatalog,
  };
}
