import { useEvent } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect } from 'react';
import { StyleProp, ViewStyle } from 'react-native';

// One cooking step's clip. It plays from the start each time its step becomes active and
// then rests on its last frame, which is the first frame of the next step's clip, so the
// steps flow into each other.
export function StepVideo({ source, active, style }: { source: number; active: boolean; style?: StyleProp<ViewStyle> }) {
  const player = useVideoPlayer(source, (p) => {
    p.loop = false;
    p.muted = true;
  });
  const { status } = useEvent(player, 'statusChange', { status: player.status });

  useEffect(() => {
    if (status !== 'readyToPlay') return;
    if (active) {
      player.replay();
      player.play();
    } else {
      player.pause();
    }
  }, [active, status, player]);

  return <VideoView player={player} style={style} contentFit="contain" nativeControls={false} pointerEvents="none" />;
}
