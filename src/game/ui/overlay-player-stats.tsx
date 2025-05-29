import { cn } from "@/lib/cn";
import { animatedWeb } from "@/lib/spring";
import { useSpring, useTransition } from "@react-spring/core";
import { gs } from "../runner";
import { useGameEventOfType, useGameStore } from "../state";

export interface OverlayPlayerStatsProps {
  controller: 0 | 1;
}

export function OverlayPlayerStats({ controller }: OverlayPlayerStatsProps) {
  const playerLp = useGameStore((s) => s.players[controller].lp);
  const { lp } = useSpring({ lp: playerLp });

  const damageEvent = useGameEventOfType(
    "lpDamage",
    (e) => e.player === controller,
  );

  const transitions = useTransition(damageEvent ? [damageEvent] : [], {
    from: { opacity: 0, y: "1cqw" },
    enter: { opacity: 1, y: "0cqw" },
    leave: { opacity: 0, y: "-1cqw" },
    keys: (item) => item?.id ?? "none",
    onRest(result, _ctrl, item) {
      if (!item) {
        return;
      }
      if (result.value.opacity === 1 && item.id === damageEvent?.id) {
        gs().nextEvent();
        console.log("LPDAMAGE NEXT EVENT");
      }
    },
  });

  return (
    <>
      {transitions(
        (springs, item) =>
          item && (
            <AnimatedDiv
              className={cn(
                "absolute w-[12cqw] z-20 text-[1.8cqw] font-mono px-[1cqw] py-[0.25cqw]",
                controller === 0
                  ? "bottom-[5.5cqw] left-[2cqw]"
                  : "top-[5.5cqw] right-[2cqw]",
              )}
              style={{ opacity: springs.opacity }}
            >
              <div className="flex gap-[0.5cqw] text-red-500">
                <span className="text-transparent">LP</span>
                <div>{item.event.amount}</div>
              </div>
            </AnimatedDiv>
          ),
      )}
      <div
        className={cn(
          "absolute w-[12cqw] z-10 bg-gray-800 text-white text-[1cqw] px-[1cqw] py-[0.25cqw]",
          controller === 0
            ? "bottom-[2cqw] left-[2cqw]"
            : "top-[2cqw] right-[2cqw]",
        )}
      >
        <div>Player {controller + 1}</div>
        <div className="text-[1.8cqw] flex gap-[0.5cqw] font-mono">
          <div>LP</div>
          <AnimatedDiv className="flex-1">
            {lp.to((lp) => lp.toFixed(0))}
          </AnimatedDiv>
        </div>
      </div>
    </>
  );
}

const AnimatedDiv = animatedWeb("div");
