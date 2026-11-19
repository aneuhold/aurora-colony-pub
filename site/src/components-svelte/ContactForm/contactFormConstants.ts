import { sharedContactFormConstants } from '@aurora/shared';

/**
 * Tweakable values for the ContactForm island. Anything that might be
 * adjusted without a logic change, like user-facing copy, lives here so the
 * component and the service stay focused on behavior. Field-length limits are spread in from `@aurora/shared` so the
 * Worker and the island share a single source of truth.
 */
export const contactFormConstants = {
  ...sharedContactFormConstants,
  textareaRows: 5,
  successMessage: 'Thanks! Your message is on its way.',
  serverErrorMessage: 'Something went wrong on our end. Please try again in a moment.',
  networkErrorMessage: 'Network error. Please try again.',
  turnstileLoadErrorMessage:
    'The spam check could not load. Please refresh the page or check that challenges.cloudflare.com is not blocked.',
  genericValidationMessage: 'Please check your entries and try again.',
  submitIdleLabel: 'Send message',
  submitBusyLabel: 'Sending…'
};
