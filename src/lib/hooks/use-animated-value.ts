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
) {
  const valueM = useMotionValue(value);

  const doAnimate = useEventCallback(() => {
    const anim = animate(valueM, value, config);
    return () => anim.stop();
  });

  useEffect(() => {
    return doAnimate();
  }, [value]);

  return valueM;
}
