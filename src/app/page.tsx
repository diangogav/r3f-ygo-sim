import { CreateForm } from "./create-form";

export default async function Home() {
  return (
    <div className="w-full max-w-lg p-4 m-auto bg-zinc-800 rounded-md flex flex-col gap-4">
      <div className="text-lg">Setup</div>
      <CreateForm />
    </div>
  );
}
