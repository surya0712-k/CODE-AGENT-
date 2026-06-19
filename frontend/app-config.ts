export interface AppConfig {
  pageTitle: string;
  pageDescription: string;
  companyName: string;

  supportsChatInput: boolean;
  supportsVideoInput: boolean;
  supportsScreenShare: boolean;
  isPreConnectBufferEnabled: boolean;

  logo: string;
  startButtonText: string;
  accent?: string;
  logoDark?: string;
  accentDark?: string;

  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorDark?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerBarCount?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerWaveLineWidth?: number;

  // agent dispatch configuration
  agentName?: string;

  /** Hint shown above controls before the first chat message. */
  preConnectMessage?: string;

  // LiveKit Cloud Sandbox configuration
  sandboxId?: string;
}

export const APP_CONFIG_DEFAULTS: AppConfig = {
  companyName: 'CODE-AGENT',
  pageTitle: 'CODE-AGENT Voice',
  pageDescription: 'Voice coding assistant with LiveKit and Cursor SDK',

  supportsChatInput: true,
  supportsVideoInput: false,
  supportsScreenShare: false,
  isPreConnectBufferEnabled: false,

  logo: '/lk-logo.svg',
  accent: '#002cf2',
  logoDark: '/lk-logo-dark.svg',
  accentDark: '#1fd5f9',
  startButtonText: 'Start call',
  preConnectMessage: 'Speak or open transcript to type',

  // Lightweight bar visualizer (avoid aura/wave WebGL for sharper, faster UI)
  audioVisualizerType: 'bar',
  audioVisualizerBarCount: 5,
  audioVisualizerColor: '#002cf2',
  audioVisualizerColorDark: '#1fd5f9',
  // audioVisualizerColorShift: 0.3,
  // audioVisualizerBarCount: 5,
  // audioVisualizerType: 'radial',
  // audioVisualizerRadialBarCount: 24,
  // audioVisualizerRadialRadius: 100,
  // audioVisualizerType: 'grid',
  // audioVisualizerGridRowCount: 25,
  // audioVisualizerGridColumnCount: 25,
  // audioVisualizerType: 'wave',
  // audioVisualizerWaveLineWidth: 3,
  // audioVisualizerType: 'aura',

  // agent dispatch configuration
  agentName: process.env.AGENT_NAME ?? 'code-voice-agent',

  // LiveKit Cloud Sandbox configuration
  sandboxId: undefined,
};
