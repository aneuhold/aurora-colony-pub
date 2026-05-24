/**
 * Public, non-secret constants for the contact Worker. CORS origins are
 * shared across all workers — see `@aurora/workers-shared`.
 */
export const contactWorkerConstants = {
  /** Inbox the form submissions are delivered to. */
  ownerEmail: 'agneuhold@gmail.com',
  /** `From` header used on outgoing Resend emails. */
  fromEmail: 'Aurora Colony Pub <onboarding@resend.dev>'
};
