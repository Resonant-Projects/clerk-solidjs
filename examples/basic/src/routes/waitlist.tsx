import { useWindowSize } from "@solid-primitives/resize-observer";
import { A } from "@solidjs/router";
import {
  Show,
  SignOutButton,
  UserButton,
  Waitlist,
} from "@resonant-projects/clerk-solidjs";

export default function Home() {
  const size = useWindowSize();

  return (
    <div class="flex flex-col w-screen h-screen items-center justify-center gap-2">
      <h1 class="text-3xl font-bold mb-5 font-mono bg-slate-300 rounded-md p-1">
        clerk-solidjs
      </h1>
      <Show when="signed-out">
        <Waitlist fallback={<p>Loading the waitlist...</p>} />
      </Show>
      <Show when="signed-in">
        <UserButton showName={size.width > 768} />
        <SignOutButton class="bg-slate-200 rounded-md px-3 py-1" />
      </Show>
      <A href="/protected" class="bg-slate-200 rounded-md px-3 py-1">
        Protected Page
      </A>
    </div>
  );
}
