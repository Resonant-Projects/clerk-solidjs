import { useWindowSize } from "@solid-primitives/resize-observer";
import { A } from "@solidjs/router";
import {
  ClerkFailed,
  ClerkLoading,
  ClerkShow,
  SignInButton,
  SignOutButton,
  UserButton,
  UserProfileModal,
} from "@resonant-projects/clerk-solidjs";
import { createSignal, Show } from "solid-js";

const DotIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
    <circle cx="8" cy="8" r="5" fill="currentColor" />
  </svg>
);

export default function Home() {
  const size = useWindowSize();
  const [modalKey, setModalKey] = createSignal<number>();

  // Defined once and used by both UserButton and UserProfileModal.
  const PreferencesPage = () => (
    <UserButton.UserProfilePage
      label="Preferences"
      url="preferences"
      labelIcon={<DotIcon />}
    >
      <div data-testid="preferences-page">
        <h2 class="text-lg font-semibold">Preferences</h2>
        <p>This page is Solid JSX. The window is {size.width}px wide.</p>
      </div>
    </UserButton.UserProfilePage>
  );

  return (
    <div class="flex flex-col w-screen h-screen items-center justify-center gap-2">
      <h1 class="text-3xl font-bold mb-5 font-mono bg-slate-300 rounded-md p-1">
        clerk-solidjs
      </h1>
      <ClerkLoading>
        <p>Loading...</p>
      </ClerkLoading>
      <ClerkFailed>
        <p>Clerk failed to load.</p>
      </ClerkFailed>
      {/* ClerkShow is Clerk's <Show>, named so it can sit beside solid-js's. It
          renders on the server from the request's auth state. */}
      <ClerkShow when="signed-out">
        <div
          class="flex flex-col items-center gap-2"
          data-testid="signed-out-state"
        >
          {/* Your own button as the child: Clerk's click handler goes on it. */}
          <SignInButton>
            <button class="bg-slate-200 rounded-md px-3 py-1">Sign in</button>
          </SignInButton>
          <A href="/sign-up" class="bg-slate-200 rounded-md px-3 py-1">
            Sign up
          </A>
        </div>
      </ClerkShow>
      <ClerkShow when="signed-in">
        <div
          class="flex flex-col items-center gap-2"
          data-testid="signed-in-state"
        >
          <UserButton
            showName={size.width > 768}
            userProfileMode="modal"
            fallback={<span class="text-slate-500">Loading account...</span>}
          >
            <UserButton.MenuItems>
              <UserButton.Action
                label="Preferences"
                labelIcon={<DotIcon />}
                open="preferences"
              />
              <UserButton.Link
                label="Protected page"
                labelIcon={<DotIcon />}
                href="/protected"
              />
              <UserButton.Link
                label="Auth details"
                labelIcon={<DotIcon />}
                href="/me"
              />
              <UserButton.Action label="manageAccount" />
              <UserButton.Action label="signOut" />
            </UserButton.MenuItems>
            <PreferencesPage />
          </UserButton>
          <button
            class="bg-slate-200 rounded-md px-3 py-1"
            onClick={() => setModalKey(Date.now())}
          >
            Open preferences
          </button>
          <A href="/me" class="bg-slate-200 rounded-md px-3 py-1">
            Auth details
          </A>
          {/* The callback takes the key, so each click mounts a new modal (a zero-argument child is an accessor). */}
          <Show when={modalKey()} keyed>
            {(_key) => (
              <UserProfileModal __experimental_startPath="/preferences">
                <PreferencesPage />
                {/* Pages can come and go: the open modal shows the change without moving the user. */}
                <Show when={size.width > 1024}>
                  <UserProfileModal.Page
                    label="Wide screens"
                    url="wide-screens"
                    labelIcon={<DotIcon />}
                  >
                    <p>
                      This page is here while the window is wider than 1024px.
                    </p>
                  </UserProfileModal.Page>
                </Show>
              </UserProfileModal>
            )}
          </Show>
          <SignOutButton class="bg-slate-200 rounded-md px-3 py-1" />
        </div>
      </ClerkShow>
      <A href="/protected" class="bg-slate-200 rounded-md px-3 py-1">
        Protected Page
      </A>
    </div>
  );
}
