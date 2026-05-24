<!--
  @component
  Contact form island. Posts name/email/message + a Turnstile token to the
  aurora-contact Worker. Includes a hidden honeypot the worker checks server-
  side. All logic (Turnstile lifecycle, fetch, response interpretation) lives
  in `ContactForm.service.ts`; this file owns state and markup.
-->
<script lang="ts">
  import contactFormService from './ContactForm.service';
  import { contactFormConstants } from './contactFormConstants';

  type Status = 'idle' | 'submitting' | 'success' | 'error';

  let name = $state('');
  let email = $state('');
  let message = $state('');
  let website = $state('');
  let turnstileToken = $state('');
  let status = $state<Status>('idle');
  let errorMessage = $state('');
  let turnstileEl = $state<HTMLDivElement | null>(null);
  let widgetId: string | null = null;

  const canSubmit = $derived(
    status !== 'submitting' &&
      turnstileToken.length > 0 &&
      name.trim().length > 0 &&
      email.trim().length > 0 &&
      message.trim().length > 0
  );

  $effect(() => {
    if (!turnstileEl) return;
    const target = turnstileEl;
    let cancelled = false;

    const mountWidget = async (): Promise<void> => {
      const id = await contactFormService.mountTurnstile(target, {
        onToken: (token) => {
          turnstileToken = token;
        },
        onExpired: () => {
          turnstileToken = '';
        },
        onError: () => {
          turnstileToken = '';
        }
      });
      // If the effect was torn down while we were awaiting the script load,
      // remove the widget here — the cleanup function already ran with widgetId still null.
      if (cancelled) {
        if (id !== null) contactFormService.removeTurnstile(id);
        return;
      }
      widgetId = id;
    };
    void mountWidget();

    return () => {
      cancelled = true;
      if (widgetId !== null) {
        contactFormService.removeTurnstile(widgetId);
        widgetId = null;
      }
    };
  });

  const handleSubmit = async (event: SubmitEvent): Promise<void> => {
    event.preventDefault();
    if (!canSubmit) return;
    status = 'submitting';
    errorMessage = '';
    const result = await contactFormService.submit({
      name,
      email,
      message,
      website,
      turnstileToken
    });
    if (result.ok) {
      status = 'success';
      name = '';
      email = '';
      message = '';
      if (widgetId !== null) contactFormService.resetTurnstile(widgetId);
      turnstileToken = '';
      return;
    }
    status = 'error';
    errorMessage = result.message;
  };
</script>

<svelte:head>
  <script src="https://challenges.cloudflare.com/turnstile/v0/api.js" async defer></script>
</svelte:head>

<div class="w-full" data-testid="contact-form">
  {#if status === 'success'}
    <p
      data-testid="contact-form-success"
      class="rounded-md border border-foreground/10 bg-foreground/5 p-4 text-foreground"
    >
      {contactFormConstants.successMessage}
    </p>
  {:else}
    <form class="flex flex-col gap-5" onsubmit={handleSubmit} novalidate>
      <label class="flex flex-col gap-2">
        <span class="font-display text-sm uppercase tracking-[0.18em] text-foreground/70">
          Name
        </span>
        <input
          data-testid="contact-form-name"
          type="text"
          name="name"
          required
          maxlength={contactFormConstants.maxNameLength}
          autocomplete="name"
          bind:value={name}
          class="rounded-md border border-foreground/15 bg-background px-3 py-2 text-foreground transition-colors duration-snap ease-soft focus:border-primary focus:outline-none"
        />
      </label>

      <label class="flex flex-col gap-2">
        <span class="font-display text-sm uppercase tracking-[0.18em] text-foreground/70">
          Email
        </span>
        <input
          data-testid="contact-form-email"
          type="email"
          name="email"
          required
          maxlength={contactFormConstants.maxEmailLength}
          autocomplete="email"
          bind:value={email}
          class="rounded-md border border-foreground/15 bg-background px-3 py-2 text-foreground transition-colors duration-snap ease-soft focus:border-primary focus:outline-none"
        />
      </label>

      <label class="flex flex-col gap-2">
        <span class="font-display text-sm uppercase tracking-[0.18em] text-foreground/70">
          Message
        </span>
        <textarea
          data-testid="contact-form-message"
          name="message"
          required
          rows={contactFormConstants.textareaRows}
          maxlength={contactFormConstants.maxMessageLength}
          bind:value={message}
          class="rounded-md border border-foreground/15 bg-background px-3 py-2 text-foreground transition-colors duration-snap ease-soft focus:border-primary focus:outline-none"
        ></textarea>
      </label>

      <!-- Honeypot: hidden from real users (visually + AT), bots tend to fill it. -->
      <input
        data-testid="contact-form-honeypot"
        type="text"
        name="website"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
        bind:value={website}
        class="pointer-events-none absolute -z-10 h-0 w-0 overflow-hidden opacity-0"
      />

      <div bind:this={turnstileEl} data-testid="contact-form-turnstile"></div>

      {#if status === 'error'}
        <p data-testid="contact-form-error" role="alert" class="text-sm text-red-600">
          {errorMessage}
        </p>
      {/if}

      <button
        data-testid="contact-form-submit"
        type="submit"
        disabled={!canSubmit}
        class="inline-flex items-center justify-center self-start rounded-md bg-primary px-5 py-2 font-medium text-primary-foreground transition-colors duration-snap ease-soft hover:bg-primary/90 disabled:opacity-50"
      >
        {status === 'submitting'
          ? contactFormConstants.submitBusyLabel
          : contactFormConstants.submitIdleLabel}
      </button>
    </form>
  {/if}
</div>
