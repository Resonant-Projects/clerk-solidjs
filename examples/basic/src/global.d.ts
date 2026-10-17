/// <reference types="@solidjs/start/env" />
/// <reference types="@solidjs/start/server" />
import { AuthReturn } from "@resonant-projects/clerk-solidjs/server";

declare module "@solidjs/start/server" {
  export interface RequestEventLocals {
    auth: AuthReturn;
  }
}

export {};
