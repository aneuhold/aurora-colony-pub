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
    void (async () => {
      widgetId = await contactFormService.mountTurnstile(target, {
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
    })();
    return () => {
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

<section class="mx-auto w-full max-w-xl px-6 py-12" data-testid="contact-form">
  <h2 class="mb-6 text-2xl font-semibold text-[color:var(--foreground)]">Contact us</h2>

  {#if status === 'success'}
    <p
      data-testid="contact-form-success"
      class="rounded-md border border-[color:var(--border)] bg-[color:var(--muted)] p-4 text-[color:var(--foreground)]"
    >
      {contactFormConstants.successMessage}
    </p>
  {:else}
    <form class="flex flex-col gap-4" onsubmit={handleSubmit} novalidate>
      <label class="flex flex-col gap-1 text-sm text-[color:var(--foreground)]">
        Name
        <input
          data-testid="contact-form-name"
          type="text"
          name="name"
          required
          maxlength={contactFormConstants.maxNameLength}
          autocomplete="name"
          bind:value={name}
          class="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[color:var(--foreground)]"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-[color:var(--foreground)]">
        Email
        <input
          data-testid="contact-form-email"
          type="email"
          name="email"
          required
          maxlength={contactFormConstants.maxEmailLength}
          autocomplete="email"
          bind:value={email}
          class="rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-[color:var(--foreground)]"
        />
      </label>

      <label class="flex flex-col gap-1 text-sm text-[color:var(--foreground)]">
        Message
        <textarea
          data-testid="contact-form-message"
          name="message"
          required
          rows={contactFormConstants.textareaRows}
          maxlength={contactFormConstants.maxMessageLength}
          bind:value={message}
          class="rounded-md border border-(--border) bg-(--background) px-3 py-2 text-[color:var(--foreground)]"
        ></textarea>
      </label>

      <!-- Honeypot: hidden from real users, bots tend to fill it. -->
      <input
        data-testid="contact-form-honeypot"
        type="text"
        name="website"
        tabindex="-1"
        autocomplete="off"
        aria-hidden="true"
        bind:value={website}
        class="absolute -left-2499.75"
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
        class="rounded-md bg-[color:var(--primary)] px-4 py-2 font-medium text-[color:var(--primary-foreground)] disabled:opacity-50"
      >
        {status === 'submitting'
          ? contactFormConstants.submitBusyLabel
          : contactFormConstants.submitIdleLabel}
      </button>
    </form>
  {/if}
</section>
