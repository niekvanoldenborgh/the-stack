import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ScrollView,
  View,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Caption, Data, Metric, Row } from './components';
import { radius, spacing, useTheme } from './theme';

/**
 * A scrubbable ruler for numeric entry.
 *
 * Adapted from the age / weight / height steps of the Fitness UI kit, which
 * pair a large read-out with a ruler you drag past a fixed centre marker.
 *
 * It replaces a plus/minus stepper for wide ranges. Setting 85 kg with a
 * stepper is ten taps; here it is one drag, and — the part that actually
 * matters — the neighbouring values stay visible, so you can see where you are
 * in the range rather than only the number you happen to be on.
 */

const TICK_SPACING = 13;
const MAJOR_EVERY = 5;

export function RulerPicker({
  value,
  onChange,
  min,
  max,
  step = 1,
  unit,
  /** Decimal places to display. Inferred from the step when omitted. */
  precision,
}: {
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  precision?: number;
}) {
  const theme = useTheme();
  const { color } = theme;
  const scrollRef = useRef<ScrollView>(null);
  const [width, setWidth] = useState(0);
  // Tracks the value the scroll position currently represents, so an incoming
  // prop change can be told apart from one this component just emitted —
  // without that check, every onChange would bounce back as a scrollTo.
  const scrolledValue = useRef(value);

  const decimals = precision ?? (Number.isInteger(step) ? 0 : String(step).split('.')[1]?.length ?? 1);
  const count = Math.round((max - min) / step) + 1;
  const indexOf = (v: number) => Math.round((v - min) / step);
  const offsetFor = (v: number) => indexOf(v) * TICK_SPACING;

  // Keep the ruler in step with the value when it is changed from outside.
  useEffect(() => {
    if (width === 0) return;
    if (Math.abs(scrolledValue.current - value) < step / 2) return;
    scrolledValue.current = value;
    scrollRef.current?.scrollTo({ x: offsetFor(value), animated: true });
    // offsetFor is derived from min/step, both in the dependency list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, width, min, step]);

  const onLayout = useCallback((event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  }, []);

  // Jump to the starting value once the width is known.
  //
  // Deliberately an effect rather than a requestAnimationFrame callback in
  // onLayout: rAF does not fire in a backgrounded tab, which would leave the
  // ruler parked at its minimum while the read-out showed the real value —
  // the two disagreeing about what is selected. Effects always run.
  const positioned = useRef(false);
  useEffect(() => {
    if (width === 0 || positioned.current) return;
    positioned.current = true;
    scrollRef.current?.scrollTo({ x: offsetFor(value), animated: false });
    // offsetFor is pure in min/step, both listed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, value, min, step]);

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(event.nativeEvent.contentOffset.x / TICK_SPACING);
    const clamped = Math.min(count - 1, Math.max(0, index));
    const next = Number((min + clamped * step).toFixed(decimals));
    if (next !== scrolledValue.current) {
      scrolledValue.current = next;
      onChange(next);
    }
  };

  return (
    <View>
      <Row justify="center" align="flex-end" gap={spacing.xs}>
        <Metric>{value.toFixed(decimals)}</Metric>
        {unit ? (
          <Data color={color.textSecondary} style={{ marginBottom: spacing.sm }}>
            {unit}
          </Data>
        ) : null}
      </Row>

      <View style={{ height: 74, marginTop: spacing.md }} onLayout={onLayout}>
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={TICK_SPACING}
          decelerationRate="fast"
          onScroll={handleScroll}
          scrollEventThrottle={16}
          contentContainerStyle={{ paddingHorizontal: Math.max(0, width / 2 - TICK_SPACING / 2) }}
        >
          {Array.from({ length: count }, (_, index) => {
            const tickValue = min + index * step;
            const major = index % MAJOR_EVERY === 0;
            return (
              <View key={index} style={{ width: TICK_SPACING, alignItems: 'center' }}>
                <View
                  style={{
                    width: major ? 2 : 1,
                    height: major ? 30 : 18,
                    borderRadius: 1,
                    backgroundColor: major ? color.borderStrong : color.border,
                  }}
                />
                {major ? <Caption color={color.textTertiary}>{Number(tickValue.toFixed(decimals))}</Caption> : null}
              </View>
            );
          })}
        </ScrollView>

        {/* Fixed centre marker. The ruler moves past this, not the other way. */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - 1,
            top: 0,
            width: 2,
            height: 36,
            borderRadius: 1,
            backgroundColor: color.primary,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: width / 2 - 5,
            top: 36,
            width: 10,
            height: 10,
            borderRadius: radius.xs,
            backgroundColor: color.primary,
          }}
        />
      </View>
    </View>
  );
}
