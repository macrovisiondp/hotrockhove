"use client";

import { startTransition } from "react";

/**
 * Submit through startTransition instead of relying on <form action> alone: React 19
 * resets a form after its action runs, which would wipe what the user typed when
 * the server returns a validation error. `action` stays on the element so the form
 * still works without JavaScript.
 */
export function submitWithoutReset(dispatch: (fd: FormData) => void) {
  return (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
    startTransition(() => dispatch(fd));
  };
}
