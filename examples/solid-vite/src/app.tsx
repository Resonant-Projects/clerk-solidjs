import { Route, Router, useNavigate } from "@solidjs/router";
import { ClerkProvider } from "@resonant-projects/clerk-solidjs";
import type { ParentProps } from "solid-js";
import Home from "./routes/home";
import Me from "./routes/me";
import Pricing from "./routes/pricing";
import Protected from "./routes/protected";
import SignInPage from "./routes/sign-in";
import SignUpPage from "./routes/sign-up";

// Clerk navigates with the router, so its redirects stay client-side.
function Root(props: ParentProps) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
    >
      {props.children}
    </ClerkProvider>
  );
}

export default function App() {
  return (
    <Router root={Root}>
      <Route path="/" component={Home} />
      <Route path="/protected" component={Protected} />
      <Route path="/me" component={Me} />
      <Route path="/pricing" component={Pricing} />
      <Route path="/sign-in/*rest" component={SignInPage} />
      <Route path="/sign-up/*rest" component={SignUpPage} />
    </Router>
  );
}
