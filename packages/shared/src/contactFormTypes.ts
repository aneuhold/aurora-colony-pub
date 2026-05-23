/**
 * Wire-format payload posted from the ContactForm island to the contact
 * Worker. Lives in the shared workspace package so the frontend and the
 * Worker stay in sync — both sides import this type rather than redeclaring
 * it. The Worker is still the source of truth for validation rules; this
 * type only fixes the field set and basic shape.
 */
export interface WorkerContactSubmitPayload {
  name: string;
  email: string;
  message: string;
  website: string;
  turnstileToken: string;
}
