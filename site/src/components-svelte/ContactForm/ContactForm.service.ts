import type { WorkerContactSubmitPayload } from '@aurora/shared';
import { globalConstants } from '$util/globalConstants';
import { contactFormConstants } from './contactFormConstants';

type ContactSubmitResult =
  | { ok: true }
  | { ok: false; kind: 'server' | 'network' | 'validation'; message: string };

interface TurnstileMountCallbacks {
  onToken: (token: string) => void;
  onExpired: () => void;
  onError: () => void;
}

/**
 * Pure-logic singleton for the ContactForm island. Owns the Turnstile widget
 * lifecycle and the POST-to-worker interpretation so `ContactForm.svelte`
 * stays focused on state and markup.
 */
class ContactFormService {
  /**
   * Polls briefly for `window.turnstile` (the Turnstile script tag loads
   * `async defer`, so it may not be ready when this island hydrates) and
   * then renders the widget into the target element.
   *
   * @param target Element to render the Turnstile widget into
   * @param callbacks Token / expiry / error handlers wired to component state
   */
  async mountTurnstile(
    target: HTMLElement,
    callbacks: TurnstileMountCallbacks
  ): Promise<string | null> {
    const deadline = Date.now() + contactFormConstants.turnstilePollTimeoutMs;
    while (typeof turnstile === 'undefined' && Date.now() < deadline) {
      await new Promise((resolve) =>
        setTimeout(resolve, contactFormConstants.turnstilePollIntervalMs)
      );
    }
    if (typeof turnstile === 'undefined') return null;
    const id = turnstile.render(target, {
      sitekey: globalConstants.turnstileSitekey,
      // Keep the widget invisible unless a visible challenge is required —
      // most visitors will silently get a token and never see the widget.
      // https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/
      appearance: 'interaction-only',
      callback: callbacks.onToken,
      'expired-callback': callbacks.onExpired,
      'error-callback': callbacks.onError
    });
    return typeof id === 'string' ? id : null;
  }

  /**
   * Removes the rendered Turnstile widget. Safe to call when the script
   * hasn't loaded — bails out if the global isn't defined.
   *
   * @param widgetId Id returned from `mountTurnstile`
   */
  removeTurnstile(widgetId: string): void {
    if (typeof turnstile === 'undefined') return;
    turnstile.remove(widgetId);
  }

  /**
   * Resets the rendered Turnstile widget so the user can solve a fresh
   * challenge (used after a successful submission).
   *
   * @param widgetId Id returned from `mountTurnstile`
   */
  resetTurnstile(widgetId: string): void {
    if (typeof turnstile === 'undefined') return;
    turnstile.reset(widgetId);
  }

  /**
   * POSTs the form payload to the contact Worker and translates the
   * response into a discriminated `ContactSubmitResult` the component can
   * pattern-match on.
   *
   * @param payload Form fields + honeypot + Turnstile token
   */
  async submit(payload: WorkerContactSubmitPayload): Promise<ContactSubmitResult> {
    try {
      const response = await fetch(globalConstants.contactWorkerUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (response.ok) return { ok: true };
      if (response.status >= 500) {
        return {
          ok: false,
          kind: 'server',
          message: contactFormConstants.serverErrorMessage
        };
      }
      const data: unknown = await response.json().catch(() => ({}));
      return {
        ok: false,
        kind: 'validation',
        message: this.extractErrorMessage(data) ?? contactFormConstants.genericValidationMessage
      };
    } catch {
      return {
        ok: false,
        kind: 'network',
        message: contactFormConstants.networkErrorMessage
      };
    }
  }

  private extractErrorMessage(data: unknown): string | null {
    if (
      typeof data === 'object' &&
      data !== null &&
      'error' in data &&
      typeof data.error === 'string'
    ) {
      return data.error;
    }
    return null;
  }
}

export default new ContactFormService();
