/**
 * Tweakable values for the ContactForm island. Anything that might be
 * adjusted without a logic change — field limits, the Turnstile polling
 * budget, user-facing copy — lives here so the component and the service
 * stay focused on behavior.
 *
 * Length limits mirror the worker-side validation in
 * `workers/contact/src/index.ts`. Keep them in sync; the server is the
 * source of truth, the client just gives quicker feedback.
 */
export const contactFormConstants = {
  maxNameLength: 100,
  maxEmailLength: 254,
  maxMessageLength: 5000,
  textareaRows: 5,
  /** Maximum time to wait for `window.turnstile` to be attached by the async script. */
  turnstilePollTimeoutMs: 5000,
  /** Poll interval while waiting for the Turnstile script to load. */
  turnstilePollIntervalMs: 50,
  successMessage: 'Thanks! Your message is on its way.',
  serverErrorMessage: 'Something went wrong on our end. Please try again in a moment.',
  networkErrorMessage: 'Network error. Please try again.',
  genericValidationMessage: 'Please check your entries and try again.',
  submitIdleLabel: 'Send message',
  submitBusyLabel: 'Sending…'
};
