import { useEffect } from "react";
import {
  useSharedValue,
  useAnimatedStyle,
  withDelay,
  withTiming,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";

type ElementConfig = {
  delay?: number;
  duration?: number;
  type?: "timing" | "spring";
  springConfig?: { mass?: number; damping?: number; stiffness?: number };
  from?: { opacity?: number; translateY?: number; scale?: number };
};

const MAX_ELEMENTS = 8;

function runEntrances(
  configs: ElementConfig[],
  opacities: SharedValue<number>[],
  translates: SharedValue<number>[],
  scales: SharedValue<number>[],
) {
  for (let i = 0; i < MAX_ELEMENTS; i++) {
    const cfg = configs[i] ?? { delay: i * 80, duration: 400, type: "timing" as const };
    const from = cfg.from ?? {};
    const opacity = from.opacity ?? 0;
    const translateY = from.translateY ?? 24;
    const scale = from.scale ?? 1;

    const delay = cfg.delay ?? i * 80;
    const dur = cfg.duration ?? 400;

    const base = { delay, dur, opacity, translateY, scale };
    const sc = cfg.springConfig ?? { mass: 0.3, damping: 14, stiffness: 180 };

    if (cfg.type === "spring") {
      opacities[i].value = base.opacity;
      translates[i].value = base.translateY;
      scales[i].value = base.scale;
      opacities[i].value = withDelay(base.delay, withTiming(1, { duration: base.dur }));
      translates[i].value = withDelay(base.delay, withSpring(0, sc));
      scales[i].value = withDelay(base.delay, withSpring(1, sc));
    } else {
      opacities[i].value = base.opacity;
      translates[i].value = base.translateY;
      scales[i].value = base.scale;
      opacities[i].value = withDelay(base.delay, withTiming(1, { duration: base.dur }));
      translates[i].value = withDelay(base.delay, withTiming(0, { duration: base.dur }));
      scales[i].value = withDelay(base.delay, withTiming(1, { duration: base.dur }));
    }
  }
}

export function useChoreographedEntrance(configs: ElementConfig[]) {
  const o0 = useSharedValue(0);
  const o1 = useSharedValue(0);
  const o2 = useSharedValue(0);
  const o3 = useSharedValue(0);
  const o4 = useSharedValue(0);
  const o5 = useSharedValue(0);
  const o6 = useSharedValue(0);
  const o7 = useSharedValue(0);

  const t0 = useSharedValue(24);
  const t1 = useSharedValue(24);
  const t2 = useSharedValue(24);
  const t3 = useSharedValue(24);
  const t4 = useSharedValue(24);
  const t5 = useSharedValue(24);
  const t6 = useSharedValue(24);
  const t7 = useSharedValue(24);

  const s0 = useSharedValue(1);
  const s1 = useSharedValue(1);
  const s2 = useSharedValue(1);
  const s3 = useSharedValue(1);
  const s4 = useSharedValue(1);
  const s5 = useSharedValue(1);
  const s6 = useSharedValue(1);
  const s7 = useSharedValue(1);

  useEffect(() => {
    runEntrances(
      configs,
      [o0, o1, o2, o3, o4, o5, o6, o7],
      [t0, t1, t2, t3, t4, t5, t6, t7],
      [s0, s1, s2, s3, s4, s5, s6, s7],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return [
    useAnimatedStyle(() => ({ opacity: o0.value, transform: [{ translateY: t0.value }, { scale: s0.value }] })),
    useAnimatedStyle(() => ({ opacity: o1.value, transform: [{ translateY: t1.value }, { scale: s1.value }] })),
    useAnimatedStyle(() => ({ opacity: o2.value, transform: [{ translateY: t2.value }, { scale: s2.value }] })),
    useAnimatedStyle(() => ({ opacity: o3.value, transform: [{ translateY: t3.value }, { scale: s3.value }] })),
    useAnimatedStyle(() => ({ opacity: o4.value, transform: [{ translateY: t4.value }, { scale: s4.value }] })),
    useAnimatedStyle(() => ({ opacity: o5.value, transform: [{ translateY: t5.value }, { scale: s5.value }] })),
    useAnimatedStyle(() => ({ opacity: o6.value, transform: [{ translateY: t6.value }, { scale: s6.value }] })),
    useAnimatedStyle(() => ({ opacity: o7.value, transform: [{ translateY: t7.value }, { scale: s7.value }] })),
  ];
}