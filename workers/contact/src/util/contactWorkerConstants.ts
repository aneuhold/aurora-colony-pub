/**
 * Public, non-secret constants for the contact Worker.
 */
export const contactWorkerConstants = {
  /** Inbox the form submissions are delivered to. */
  ownerEmail: 'agneuhold@gmail.com',
  /** `From` header used on outgoing Resend emails. */
  fromEmail: 'Aurora Colony Pub <onboarding@resend.dev>',
  /** Origins permitted to POST to this Worker (CORS allowlist). */
  allowedOrigins: ['https://aurora-colony-pub-frontend.pages.dev', 'http://localhost:4321']
};
