import { createSignal } from "solid-js";
import { useSignIn } from "@resonant-projects/clerk-solidjs";

/**
 * A custom sign-in form on Clerk Core 3's signal-based `useSignIn()`. The
 * resource and `errors` stay reactive when destructured; `fetchStatus` is read
 * from the result.
 */
export default function CustomSignIn() {
  const state = useSignIn();
  const { signIn, errors } = state;
  const [identifier, setIdentifier] = createSignal("");

  const submit = async (event: SubmitEvent) => {
    event.preventDefault();
    await signIn.create({ identifier: identifier() });
  };

  return (
    <form
      onSubmit={submit}
      class="flex flex-col w-screen h-screen items-center justify-center gap-2"
    >
      <h1 class="text-3xl font-bold mb-5 font-mono">Custom sign-in</h1>
      <label class="flex flex-col">
        Email address
        <input
          name="identifier"
          type="email"
          class="border rounded-md px-2 py-1"
          value={identifier()}
          onInput={(event) => setIdentifier(event.currentTarget.value)}
        />
      </label>
      {errors.fields.identifier && (
        <p role="alert" class="text-red-700">
          {errors.fields.identifier.message}
        </p>
      )}
      <p data-testid="sign-in-status">{signIn.status}</p>
      <button
        type="submit"
        class="bg-slate-200 rounded-md px-3 py-1"
        disabled={state.fetchStatus === "fetching"}
      >
        Continue
      </button>
    </form>
  );
}
