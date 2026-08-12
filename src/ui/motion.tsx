import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, type StyleProp, type ViewStyle } from 'react-native';

/**
 * react-native-web has no native animation driver, and passing
 * `useNativeDriver: true` there does not fall back — it silently never runs,
 * stranding whatever the animation was revealing at its initial value. Since
 * these animations gate content visibility, that failure mode is invisible
 * content rather than a missing flourish, so the flag is platform-gated.
 */
const NATIVE_DRIVER = Platform.OS !== 'web';

/**
 * Entrance motion.
 *
 * Deliberately built on the core Animated API with `useNativeDriver` rather
 * than Reanimated layout animations: this app runs on iOS, Android and web from
 * one bundle, and Reanimated's entering/exiting animations are the least
 * reliable part of that story on web. Opacity and transform are both
 * native-drivable, so this stays on the UI thread anyway.
 *
 * The pattern is one orchestrated reveal per screen — a staggered cascade as
 * the content lands — rather than micro-interactions sprinkled everywhere. One
 * well-timed entrance reads as craft; twitching components read as noise.
 */

const DURATION = 420;
const STAGGER = 55;
/** Beyond this the wait stops feeling like choreography and starts feeling slow. */
const MAX_STAGGER_INDEX = 12;

export function Reveal({
  children,
  index = 0,
  distance = 14,
  style,
}: {
  children: ReactNode;
  /** Position in the cascade. Later items wait longer before appearing. */
  index?: number;
  distance?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const progress = useRef(new Animated.Value(0)).current;
  const delay = Math.min(index, MAX_STAGGER_INDEX) * STAGGER;

  useEffect(() => {
    // Browsers do not fire requestAnimationFrame in a hidden tab, so a
    // JS-driven animation started there never progresses — and because this
    // one gates opacity, the content would stay invisible until something
    // forced a re-render. Nobody is watching an entrance they cannot see, so
    // skip straight to the resolved state.
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.hidden) {
      progress.setValue(1);
      return;
    }

    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: DURATION,
      delay,
      // Gentle deceleration — content settles rather than snapping.
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: NATIVE_DRIVER,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, delay]);

  const translateY = useMemo(
    () => progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
    [progress, distance],
  );

  return (
    <Animated.View style={[{ opacity: progress, transform: [{ translateY }] }, style]}>
      {children}
    </Animated.View>
  );
}

/**
 * A value that eases toward its target whenever it changes.
 *
 * Used for the risk dial, where the dose needs to visibly *move* rather than
 * cut — the whole point of the control is that you can feel it responding.
 */
export function useAnimatedNumber(value: number, duration = 260): Animated.Value {
  const animated = useRef(new Animated.Value(value)).current;

  useEffect(() => {
    const animation = Animated.timing(animated, {
      toValue: value,
      duration,
      easing: Easing.out(Easing.cubic),
      // Interpolated into a colour/width, so this one cannot be native-driven.
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [animated, value, duration]);

  return animated;
}

/** Pulses once whenever `trigger` changes. Used to acknowledge a live update. */
export function usePulse(trigger: unknown): Animated.Value {
  const scale = useRef(new Animated.Value(1)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const animation = Animated.sequence([
      Animated.timing(scale, { toValue: 1.04, duration: 110, useNativeDriver: NATIVE_DRIVER, easing: Easing.out(Easing.quad) }),
      Animated.timing(scale, { toValue: 1, duration: 200, useNativeDriver: NATIVE_DRIVER, easing: Easing.out(Easing.quad) }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [scale, trigger]);

  return scale;
}
