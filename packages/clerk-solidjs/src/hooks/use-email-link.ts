import { deprecated } from '@clerk/shared/deprecated';
import type {
  CreateEmailLinkFlowReturn,
  EmailAddressResource,
  SignInResource,
  SignInStartEmailLinkFlowParams,
  SignUpResource,
  StartEmailLinkFlowParams
} from '@clerk/shared/types';
import { Accessor, createEffect, on, onCleanup } from 'solid-js';

type EmailLinkable = SignUpResource | EmailAddressResource | SignInResource;

type EmailLinkReturn<Params, Resource> = {
  /**
   * Sends the email link and resolves once it has been used.
   *
   * Called without params it returns itself, for code written for the
   * accessor this hook returned before 4.3 (`startEmailLinkFlow()(params)`).
   */
  startEmailLinkFlow: {
    (params: Params): Promise<Resource>;
    /** @deprecated Call `startEmailLinkFlow(params)`. */
    (): (params: Params) => Promise<Resource>;
  };
  /**
   * Stops waiting for the link. It returns a function that does the same, so
   * code written for the accessor (`cancelEmailLinkFlow()()`) keeps working.
   */
  cancelEmailLinkFlow: () => () => void;
};

export type UseEmailLinkSignInReturn = EmailLinkReturn<
  SignInStartEmailLinkFlowParams,
  SignInResource
>;
export type UseEmailLinkSignUpReturn = EmailLinkReturn<
  StartEmailLinkFlowParams,
  SignUpResource
>;
export type UseEmailLinkEmailAddressReturn = EmailLinkReturn<
  StartEmailLinkFlowParams,
  EmailAddressResource
>;

type Flows = CreateEmailLinkFlowReturn<any, any>;

/**
 * Clerk's email link flow for a sign-in, sign-up or email address, as
 * `@clerk/react`'s `useEmailLink`: `startEmailLinkFlow(params)` and
 * `cancelEmailLinkFlow()` are plain functions. The flow belongs to the
 * resource the accessor returns when it starts; it is cancelled when the
 * resource changes or the component unmounts.
 *
 * @example
 * const { startEmailLinkFlow } = useEmailLink(() => signIn);
 * await startEmailLinkFlow({ emailAddressId, redirectUrl });
 */
function useEmailLink(
  resource: Accessor<SignInResource>
): UseEmailLinkSignInReturn;
function useEmailLink(
  resource: Accessor<SignUpResource>
): UseEmailLinkSignUpReturn;
function useEmailLink(
  resource: Accessor<EmailAddressResource>
): UseEmailLinkEmailAddressReturn;
function useEmailLink(
  resource: Accessor<EmailLinkable>
):
  | UseEmailLinkSignInReturn
  | UseEmailLinkSignUpReturn
  | UseEmailLinkEmailAddressReturn {
  // Made on first use, not in a memo: creating a flow is not a derivation,
  // and nothing runs on the server.
  let current: { resource: EmailLinkable; flows: Flows } | undefined;
  const flows = () => {
    const target = resource();
    if (current?.resource !== target) {
      current?.flows.cancelEmailLinkFlow();
      current = { resource: target, flows: target.createEmailLinkFlow() };
    }
    return current.flows;
  };

  // A flow for a resource the accessor no longer returns stops waiting.
  createEffect(
    on(resource, (target) => {
      onCleanup(() => {
        if (current?.resource === target) {
          current.flows.cancelEmailLinkFlow();
          current = undefined;
        }
      });
    })
  );

  const start = (params: unknown) => flows().startEmailLinkFlow(params);

  const startEmailLinkFlow = ((...args: unknown[]) => {
    if (args.length === 0) {
      deprecated(
        'useEmailLink().startEmailLinkFlow()',
        'It is a function now: call `startEmailLinkFlow(params)`.'
      );
      return start;
    }
    return start(args[0]);
  }) as UseEmailLinkSignInReturn['startEmailLinkFlow'];

  const cancelEmailLinkFlow = (): (() => void) => {
    current?.flows.cancelEmailLinkFlow();
    return () => current?.flows.cancelEmailLinkFlow();
  };

  return { startEmailLinkFlow, cancelEmailLinkFlow };
}

export { useEmailLink };
