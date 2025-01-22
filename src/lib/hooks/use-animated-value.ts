import {
  animate,
  useMotionValue,
  ValueAnimationTransition,
} from "framer-motion";
import { useEffect } from "react";
import { useEventCallback } from "usehooks-ts";

export function useAnimatedValue(
  value: number,
  config?: ValueAnimationTransition<number>,
  initial?: number,
) {
  const valueM = useMotionValue(initial ?? value);
  const update = useEventCallback(() => {
    const controls = animate(valueM, value, config);
    return () => controls.stop();
  });
  useEffect(() => {
    return update();
  }, [value, update]);
  return valueM;
}
