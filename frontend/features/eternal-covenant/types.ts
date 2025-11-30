export interface CovenantState {
  isHovering: boolean;
  hoverDuration: number;
  clickSequence: number[];
  isCovenantActive: boolean;
  metricsData: MetricsData;
  audioState: AudioPlaybackState;
}

export interface MetricsData {
  totalViews: number;
  currentViewDuration: number;
  lastActivation: Date;
  completedViewings: number;
}

export interface AudioPlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isLoaded: boolean;
}

export interface EternalCovenantContextType {
  state: CovenantState;
  activateCovenant: () => void;
  deactivateCovenant: () => void;
  updateHoverState: (isHovering: boolean) => void;
  registerClick: () => void;
  playAudio: () => Promise<void>;
  pauseAudio: () => void;
}