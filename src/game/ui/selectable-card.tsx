import { cn } from "@/lib/cn";
import { textureCardFront } from "../textures";

export interface SelectableCardProps {
  code: number;
  selected: boolean;
  onSelect: () => void;
  onUnselect: () => void;
}

export function SelectableCard({
  code,
  selected,
  onSelect,
  onUnselect,
}: SelectableCardProps) {
  return (
    <div
      className="flex-none bg-black relative"
      onClick={() => (selected ? onUnselect() : onSelect())}
    >
      <img
        className={cn("h-[8cqw] opacity-75", selected && "opacity-100")}
        src={textureCardFront(code)}
        alt=""
      />
      {selected && <div className="absolute -top-3 -left-2 w-4 h-4">✅</div>}
    </div>
  );
}
