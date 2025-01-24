"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { twc } from "react-twc";

export function CreateForm({}: {}) {
  const router = useRouter();
  const { register, handleSubmit } = useForm({
    defaultValues: {
      decks: ["", ""],
      seed: [1238828193, 223912, 144449391, 34443123],
    },
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={handleSubmit((values) => {
        const params = new URLSearchParams({
          d: JSON.stringify(values),
        });
        router.push(`/play?${params}`);
      })}
    >
      <div className="flex flex-col gap-2">
        <Label>Player 1 Deck</Label>
        <Input
          {...register("decks.0", { required: true })}
          type="text"
          placeholder="ydke://..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Player 2 Deck</Label>
        <Input
          {...register("decks.1", { required: true })}
          type="text"
          placeholder="ydke://..."
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Seed</Label>
        <div className="flex gap-1">
          <Input
            {...register("seed.0", { valueAsNumber: true })}
            className="flex-1"
            type="text"
            placeholder="12345"
          />
          <Input
            {...register("seed.1", { valueAsNumber: true })}
            className="flex-1"
            type="text"
            placeholder="12345"
          />
          <Input
            {...register("seed.2", { valueAsNumber: true })}
            className="flex-1"
            type="text"
            placeholder="12345"
          />
          <Input
            {...register("seed.3", { valueAsNumber: true })}
            className="flex-1"
            type="text"
            placeholder="12345"
          />
        </div>
      </div>
      <div>
        <Button>Start</Button>
      </div>
    </form>
  );
}

const Button = twc.button`inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-100 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-yellow-400 text-yellow-950 shadow hover:bg-yellow-400/90 h-9 px-4 py-2 w-full`;

const Label = twc.label`text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70`;

const Input = twc.input`flex h-9 w-full rounded-md border border-zinc-600 bg-transparent px-3 py-1 text-white shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-zinc-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-100 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm`;
