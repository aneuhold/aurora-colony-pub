/**
 * Public, non-secret constants shared across the site.
 */
export const globalConstants = {
  contactWorkerUrl: import.meta.env.DEV
    ? 'http://localhost:8787'
    : 'https://aurora-contact.agneuhold.workers.dev',
  fbFeedReadWorkerUrl: import.meta.env.DEV
    ? 'http://localhost:8788'
    : 'https://aurora-fb-feed-read.agneuhold.workers.dev',
  /** Cloudflare Turnstile sitekey for the contact form widget. */
  turnstileSitekey: '0x4AAAAAADVCwonowFDxQAhi'
};
