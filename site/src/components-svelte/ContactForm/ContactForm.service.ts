import type { WorkerContactSubmitPayload } from '@aurora/shared';
import { globalConstants } from '$util/globalConstants';
import { contactFormConstants } from './contactFormConstants';

/**
 * Pure-logic singleton for the ContactForm island. Owns the Turnstile widget
 * lifecycle and the POST-to-worker interpretation so `ContactForm.svelte`
 * stays focused on state and markup.
 */
class ContactFormService {
  // `render=explicit` is the documented mode for calling `turnstile.render()`
  // yourself:
  // https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/#explicit-rendering
  static readonly #SCRIPT_URL =
    'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

  #scriptLoad: Promise<boolean> | null = null;

  /**
   * Loads the Turnstile script if needed, then renders the widget into the
   * target element. Resolves `null` when the script fails to load.
   *
   * @param target Element to render the Turnstile widget into
   * @param callbacks Handlers for the widget's lifecycle events
   * @param callbacks.onToken Called with a new token when a challenge passes
   * @param callbacks.onExpired Called when the current token expires
   * @param callbacks.onError Called when the widget hits an error
   */
  async mountTurnstile(
    target: HTMLElement,
    callbacks: {
      onToken: (token: string) => void;
      onExpired: () => void;
      onError: () => void;
    }
  ): Promise<string | null> {
    if (!(await this.#loadScript())) return null;
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
   * Removes the rendered Turnstile widget.
   *
   * @param widgetId Id returned from `mountTurnstile`
   */
  removeTurnstile(widgetId: string): void {
    turnstile.remove(widgetId);
  }

  /**
   * Resets the rendered Turnstile widget so it issues a fresh token.
   *
   * @param widgetId Id returned from `mountTurnstile`
   */
  resetTurnstile(widgetId: string): void {
    turnstile.reset(widgetId);
  }

  /**
   * POSTs the form payload to the contact Worker. Resolves `{ ok: true }` on
   * success, otherwise `ok: false` with the failure `kind` and a
   * user-facing `message`.
   *
   * @param payload Form fields + honeypot + Turnstile token
   */
  async submit(
    payload: WorkerContactSubmitPayload
  ): Promise<
    { ok: true } | { ok: false; kind: 'server' | 'network' | 'validation'; message: string }
  > {
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
        message: this.#extractErrorMessage(data) ?? contactFormConstants.genericValidationMessage
      };
    } catch {
      return {
        ok: false,
        kind: 'network',
        message: contactFormConstants.networkErrorMessage
      };
    }
  }

  /**
   * Adds the Turnstile script to the page once and resolves `true` on its
   * `load` event (the script has run, so `turnstile` exists) or `false` on
   * its `error` event. A failed load is forgotten so the next mount retries.
   */
  #loadScript(): Promise<boolean> {
    if (typeof turnstile !== 'undefined') return Promise.resolve(true);
    this.#scriptLoad ??= new Promise((resolve) => {
      const script = document.createElement('script');
      script.src = ContactFormService.#SCRIPT_URL;
      script.addEventListener('load', () => {
        resolve(true);
      });
      script.addEventListener('error', () => {
        script.remove();
        this.#scriptLoad = null;
        resolve(false);
      });
      document.head.append(script);
    });
    return this.#scriptLoad;
  }

  /**
   * Returns the `error` string from a Worker error body, or `null` when the
   * body has none.
   *
   * @param data Parsed JSON response body
   */
  #extractErrorMessage(data: unknown): string | null {
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

const contactFormService = new ContactFormService();
export default contactFormService;
