
export type AudioState = {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isLoading: boolean;
  hasError: boolean;
};

type StateChangeCallback = (state: AudioState) => void;
type TrackEndCallback = () => void;

class AudioManager {
  private static instance: AudioManager;
  private audio: HTMLAudioElement;
  private state: AudioState;
  
  private onStateChange: StateChangeCallback | null = null;
  private onTrackEnd: TrackEndCallback | null = null;
  
  private constructor() {
    this.audio = new Audio();
    // Default config for best background/stream performance
    this.audio.preload = 'auto';
    
    this.state = {
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 1,
      isLoading: false,
      hasError: false
    };

    this.setupListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private setupListeners() {
    this.audio.addEventListener('play', () => this.updateState({ isPlaying: true, hasError: false }));
    this.audio.addEventListener('pause', () => this.updateState({ isPlaying: false }));
    this.audio.addEventListener('timeupdate', () => this.updateState({ currentTime: this.audio.currentTime }));
    this.audio.addEventListener('durationchange', () => this.updateState({ duration: this.audio.duration }));
    this.audio.addEventListener('volumechange', () => this.updateState({ volume: this.audio.volume }));
    this.audio.addEventListener('waiting', () => this.updateState({ isLoading: true }));
    this.audio.addEventListener('playing', () => this.updateState({ isLoading: false }));
    this.audio.addEventListener('canplay', () => this.updateState({ isLoading: false }));
    this.audio.addEventListener('error', (e) => {
      console.error("Audio playback error:", e);
      this.updateState({ hasError: true, isLoading: false, isPlaying: false });
    });
    
    this.audio.addEventListener('ended', () => {
      this.updateState({ isPlaying: false, currentTime: 0 });
      if (this.onTrackEnd) this.onTrackEnd();
    });
  }

  private updateState(newState: Partial<AudioState>) {
    this.state = { ...this.state, ...newState };
    if (this.onStateChange) {
      this.onStateChange(this.state);
    }
  }

  public subscribe(onStateChange: StateChangeCallback, onTrackEnd: TrackEndCallback) {
    this.onStateChange = onStateChange;
    this.onTrackEnd = onTrackEnd;
    
    // Fire initial state
    onStateChange(this.state);
    
    return () => {
      this.onStateChange = null;
      this.onTrackEnd = null;
    };
  }

  public async play(url?: string, metadata?: MediaMetadataInit) {
    try {
      if (url && this.audio.src !== url) {
        this.updateState({ isLoading: true, hasError: false });
        this.audio.src = url;
        this.audio.load();
      }
      
      this.updateMediaSession(metadata);
      await this.audio.play();
    } catch (e) {
      console.error("Failed to play audio:", e);
      this.updateState({ hasError: true, isLoading: false });
    }
  }

  public pause() {
    this.audio.pause();
  }

  public togglePlay() {
    if (this.state.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  public seek(time: number) {
    this.audio.currentTime = time;
    this.updateState({ currentTime: time });
  }

  public setVolume(volume: number) {
    this.audio.volume = Math.max(0, Math.min(1, volume));
  }

  // --- Media Session API ---
  private updateMediaSession(metadata?: MediaMetadataInit) {
    if ('mediaSession' in navigator && metadata) {
      navigator.mediaSession.metadata = new MediaMetadata(metadata);
    }
  }

  public setMediaSessionActionHandlers(handlers: {
    onPlay: () => void;
    onPause: () => void;
    onNext: () => void;
    onPrevious: () => void;
  }) {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.setActionHandler('play', () => {
        this.play();
        handlers.onPlay();
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        this.pause();
        handlers.onPause();
      });
      navigator.mediaSession.setActionHandler('previoustrack', handlers.onPrevious);
      navigator.mediaSession.setActionHandler('nexttrack', handlers.onNext);
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.fastSeek && 'fastSeek' in this.audio) {
          (this.audio as any).fastSeek(details.seekTime || 0);
        } else {
          this.seek(details.seekTime || 0);
        }
      });
    }
  }
}

export const audioManager = AudioManager.getInstance();
