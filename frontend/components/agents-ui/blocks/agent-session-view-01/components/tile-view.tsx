import React, { useEffect, useMemo, useState } from 'react';
import { Track } from 'livekit-client';
import { AnimatePresence, type MotionProps, motion } from 'motion/react';
import {
  type TrackReference,
  VideoTrack,
  useLocalParticipant,
  useTracks,
  useVoiceAssistant,
} from '@livekit/components-react';
import { cn } from '@/lib/shadcn/utils';
import { AudioVisualizer } from './audio-visualizer';

const ANIMATION_TRANSITION_SPRING: MotionProps['transition'] = {
  type: 'spring',
  stiffness: 320,
  damping: 32,
  mass: 0.8,
};

const ANIMATION_TRANSITION_INSTANT: MotionProps['transition'] = {
  duration: 0,
};

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return reduced;
}

const tileViewClassNames = {
  // GRID
  // 2 Columns x 3 Rows
  grid: [
    'h-full w-full',
    'grid gap-x-2 place-content-center',
    'grid-cols-[1fr_1fr] grid-rows-[minmax(13rem,1fr)_1fr_5rem]',
  ],
  // Agent
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 1 / Row 1
  // align: x-end y-center
  agentChatOpenWithSecondTile: ['col-start-1 row-start-1', 'self-center justify-self-end'],
  // Agent
  // chatOpen: true,
  // hasSecondTile: false
  // layout: Column 1 / Row 1 / Column-Span 2
  // align: x-center y-center
  agentChatOpenWithoutSecondTile: ['col-start-1 row-start-1', 'col-span-2', 'place-content-center'],
  // Agent
  // chatOpen: false
  // layout: Column 1 / Row 1 / Column-Span 2 / Row-Span 3
  // align: x-center y-center
  agentChatClosed: ['col-start-1 row-start-1', 'col-span-2 row-span-3', 'place-content-center'],
  // Second tile
  // chatOpen: true,
  // hasSecondTile: true
  // layout: Column 2 / Row 1
  // align: x-start y-center
  secondTileChatOpen: ['col-start-2 row-start-1', 'self-center justify-self-start'],
  // Second tile
  // chatOpen: false,
  // hasSecondTile: false
  // layout: Column 2 / Row 2
  // align: x-end y-end
  secondTileChatClosed: ['col-start-2 row-start-3', 'place-content-end'],
};

export function useLocalTrackRef(source: Track.Source) {
  const { localParticipant } = useLocalParticipant();
  const publication = localParticipant.getTrackPublication(source);
  const trackRef = useMemo<TrackReference | undefined>(
    () => (publication ? { source, participant: localParticipant, publication } : undefined),
    [source, publication, localParticipant]
  );
  return trackRef;
}

interface TileLayoutProps {
  chatOpen: boolean;
  audioVisualizerType?: 'bar' | 'wave' | 'grid' | 'radial' | 'aura';
  audioVisualizerColor?: `#${string}`;
  audioVisualizerColorShift?: number;
  audioVisualizerWaveLineWidth?: number;
  audioVisualizerGridRowCount?: number;
  audioVisualizerGridColumnCount?: number;
  audioVisualizerRadialBarCount?: number;
  audioVisualizerRadialRadius?: number;
  audioVisualizerBarCount?: number;
}

type VisualizerProps = Omit<TileLayoutProps, 'chatOpen'>;

function useAgentTileState() {
  const { videoTrack: agentVideoTrack } = useVoiceAssistant();
  const [screenShareTrack] = useTracks([Track.Source.ScreenShare]);
  const cameraTrack: TrackReference | undefined = useLocalTrackRef(Track.Source.Camera);
  const isCameraEnabled = cameraTrack && !cameraTrack.publication.isMuted;
  const isScreenShareEnabled = screenShareTrack && !screenShareTrack.publication.isMuted;
  const isAvatar = agentVideoTrack !== undefined;
  const videoWidth = agentVideoTrack?.publication.dimensions?.width ?? 0;
  const videoHeight = agentVideoTrack?.publication.dimensions?.height ?? 0;

  return {
    agentVideoTrack,
    screenShareTrack,
    cameraTrack,
    isCameraEnabled,
    isScreenShareEnabled,
    hasSecondTile: isCameraEnabled || isScreenShareEnabled,
    isAvatar,
    videoWidth,
    videoHeight,
  };
}

/** Small centered visualizer for transcript mode — sits in its own row above messages. */
export function CompactAgentTile({
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerWaveLineWidth,
}: VisualizerProps) {
  const { agentVideoTrack, isAvatar, videoWidth, videoHeight } = useAgentTileState();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="pointer-events-none flex size-[4.5rem] items-center justify-center"
      aria-hidden
    >
      {!isAvatar ? (
        <AudioVisualizer
          audioVisualizerType={audioVisualizerType ?? 'bar'}
          audioVisualizerColor={audioVisualizerColor}
          audioVisualizerColorShift={audioVisualizerColorShift}
          audioVisualizerBarCount={audioVisualizerBarCount ?? 5}
          audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
          audioVisualizerRadialRadius={audioVisualizerRadialRadius}
          audioVisualizerGridRowCount={audioVisualizerGridRowCount}
          audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
          audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
          isChatOpen
          className="border-input bg-background size-[4.5rem] rounded-full border shadow-md"
          style={{ color: audioVisualizerColor, transform: 'translateZ(0)' }}
        />
      ) : (
        <VideoTrack
          width={videoWidth}
          height={videoHeight}
          trackRef={agentVideoTrack}
          className="size-[4.5rem] overflow-hidden rounded-full bg-black object-cover"
        />
      )}
    </motion.div>
  );
}

export function TileLayout({
  chatOpen,
  audioVisualizerType,
  audioVisualizerColor,
  audioVisualizerColorShift,
  audioVisualizerBarCount,
  audioVisualizerRadialBarCount,
  audioVisualizerRadialRadius,
  audioVisualizerGridRowCount,
  audioVisualizerGridColumnCount,
  audioVisualizerWaveLineWidth,
}: TileLayoutProps) {
  const prefersReducedMotion = usePrefersReducedMotion();
  const animationTransition = prefersReducedMotion
    ? ANIMATION_TRANSITION_INSTANT
    : ANIMATION_TRANSITION_SPRING;
  const {
    agentVideoTrack,
    screenShareTrack,
    cameraTrack,
    isCameraEnabled,
    isScreenShareEnabled,
    hasSecondTile,
    isAvatar,
    videoWidth,
    videoHeight,
  } = useAgentTileState();

  const animationDelay = 0.15;

  if (chatOpen) {
    return null;
  }

  return (
    <div className="absolute inset-x-0 top-20 bottom-32 z-10 md:top-24 md:bottom-40">
      <div className="relative mx-auto h-full max-w-2xl px-4 md:px-0">
        <div className={cn(tileViewClassNames.grid)}>
          {/* Agent */}
          <div
            className={cn([
              'grid',
              tileViewClassNames.agentChatClosed,
            ])}
          >
            <AnimatePresence mode="popLayout">
              {!isAvatar && (
                // Audio Agent
                <motion.div
                  key="agent"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{
                    duration: 0.25,
                    delay: animationDelay,
                  }}
                  className="relative flex size-[min(18rem,48vw)] items-center justify-center md:size-[17rem]"
                >
                  <AudioVisualizer
                    key="audio-visualizer"
                    audioVisualizerType={audioVisualizerType ?? 'bar'}
                    audioVisualizerColor={audioVisualizerColor}
                    audioVisualizerColorShift={audioVisualizerColorShift}
                    audioVisualizerBarCount={audioVisualizerBarCount ?? 5}
                    audioVisualizerRadialBarCount={audioVisualizerRadialBarCount}
                    audioVisualizerRadialRadius={audioVisualizerRadialRadius}
                    audioVisualizerGridRowCount={audioVisualizerGridRowCount}
                    audioVisualizerGridColumnCount={audioVisualizerGridColumnCount}
                    audioVisualizerWaveLineWidth={audioVisualizerWaveLineWidth}
                    isChatOpen={false}
                    className="bg-background size-full max-w-[17rem] rounded-[50px] border border-transparent transition-[border,box-shadow]"
                    style={{
                      color: audioVisualizerColor,
                      transform: 'translateZ(0)',
                    }}
                  />
                </motion.div>
              )}

              {isAvatar && (
                // Avatar Agent
                <motion.div
                  key="avatar"
                  layoutId="avatar"
                  initial={{
                    scale: 1,
                    opacity: 1,
                    maskImage:
                      'radial-gradient(circle, rgba(0, 0, 0, 1) 0, rgba(0, 0, 0, 1) 20px, transparent 20px)',
                    filter: 'blur(20px)',
                  }}
                  animate={{
                    maskImage:
                      'radial-gradient(circle, rgba(0, 0, 0, 1) 0, rgba(0, 0, 0, 1) 500px, transparent 500px)',
                    filter: 'blur(0px)',
                    borderRadius: 12,
                  }}
                  transition={{
                    ...animationTransition,
                    delay: animationDelay,
                    maskImage: {
                      duration: 1,
                    },
                    filter: {
                      duration: 1,
                    },
                  }}
                  className="h-auto w-full overflow-hidden bg-black drop-shadow-xl/80"
                >
                  <VideoTrack
                    width={videoWidth}
                    height={videoHeight}
                    trackRef={agentVideoTrack}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div
            className={cn([
              'grid',
              tileViewClassNames.secondTileChatClosed,
            ])}
          >
            {/* Camera & Screen Share */}
            <AnimatePresence>
              {((cameraTrack && isCameraEnabled) || (screenShareTrack && isScreenShareEnabled)) && (
                <motion.div
                  key="camera"
                  layout="position"
                  layoutId="camera"
                  initial={{
                    opacity: 0,
                    scale: 0,
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    opacity: 0,
                    scale: 0,
                  }}
                  transition={{
                    ...animationTransition,
                    delay: animationDelay,
                  }}
                  className="aspect-square size-[90px] drop-shadow-lg/20"
                >
                  <VideoTrack
                    trackRef={cameraTrack || screenShareTrack}
                    width={(cameraTrack || screenShareTrack)?.publication.dimensions?.width ?? 0}
                    height={(cameraTrack || screenShareTrack)?.publication.dimensions?.height ?? 0}
                    className="bg-muted aspect-square size-[90px] rounded-md object-cover"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
