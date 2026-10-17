import { useWindowSize } from "@solid-primitives/resize-observer";
import { A } from "@solidjs/router";
import {
  ClerkLoaded,
  ClerkLoading,
  SignedIn,
  SignedOut,
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
      <ClerkLoaded>
        <SignedOut>
          <SignInButton class="bg-slate-200 rounded-md px-3 py-1" />
        </SignedOut>
        <SignedIn>
          <UserButton showName={size.width > 768} userProfileMode="modal">
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
          {/* The callback takes the key, so each click mounts a new modal (a zero-argument child is an accessor). */}
          <Show when={modalKey()} keyed>
            {(_key) => (
              <UserProfileModal __experimental_startPath="/preferences">
                <PreferencesPage />
              </UserProfileModal>
            )}
          </Show>
          <SignOutButton class="bg-slate-200 rounded-md px-3 py-1" />
        </SignedIn>
      </ClerkLoaded>
      <A href="/protected" class="bg-slate-200 rounded-md px-3 py-1">
        Protected Page
      </A>
    </div>
  );
}
