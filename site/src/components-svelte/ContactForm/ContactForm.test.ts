import { cleanup, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderSvelteComponent } from '../../../testUtils/renderSvelteComponent';
import contactFormService from './ContactForm.service';
import ContactForm from './ContactForm.svelte';

const installTurnstileMock = (): { triggerToken: (token: string) => void } => {
  let savedCallback: ((token: string) => void) | null = null;
  vi.spyOn(contactFormService, 'mountTurnstile').mockImplementation(async (_target, callbacks) => {
    savedCallback = callbacks.onToken;
    return Promise.resolve('widget-1');
  });
  vi.spyOn(contactFormService, 'removeTurnstile').mockImplementation(() => {});
  vi.spyOn(contactFormService, 'resetTurnstile').mockImplementation(() => {});
  return {
    triggerToken: (token: string) => {
      savedCallback?.(token);
    }
  };
};

describe('ContactForm', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('renders the name, email, message, and honeypot inputs', () => {
    installTurnstileMock();
    renderSvelteComponent(ContactForm);
    expect(screen.getByTestId('contact-form-name')).toBeInTheDocument();
    expect(screen.getByTestId('contact-form-email')).toBeInTheDocument();
    expect(screen.getByTestId('contact-form-message')).toBeInTheDocument();
    const honeypot = screen.getByTestId('contact-form-honeypot');
    expect(honeypot).toBeInTheDocument();
    expect(honeypot.getAttribute('tabindex')).toBe('-1');
  });

  it('keeps the submit button disabled until a Turnstile token arrives', async () => {
    const { triggerToken } = installTurnstileMock();
    const user = userEvent.setup();
    renderSvelteComponent(ContactForm);

    await user.type(screen.getByTestId('contact-form-name'), 'Alice');
    await user.type(screen.getByTestId('contact-form-email'), 'a@example.com');
    await user.type(screen.getByTestId('contact-form-message'), 'Hello');

    const submit = screen.getByTestId('contact-form-submit');
    expect(submit).toBeDisabled();

    triggerToken('test-token');
    await vi.waitFor(() => expect(submit).not.toBeDisabled());
  });

  it('delegates submission to the service with the entered values', async () => {
    const { triggerToken } = installTurnstileMock();
    const submitSpy = vi.spyOn(contactFormService, 'submit').mockResolvedValue({ ok: true });
    const user = userEvent.setup();
    renderSvelteComponent(ContactForm);

    await user.type(screen.getByTestId('contact-form-name'), 'Alice');
    await user.type(screen.getByTestId('contact-form-email'), 'a@example.com');
    await user.type(screen.getByTestId('contact-form-message'), 'Hello there');
    triggerToken('test-token');
    await vi.waitFor(() => expect(screen.getByTestId('contact-form-submit')).not.toBeDisabled());

    await user.click(screen.getByTestId('contact-form-submit'));

    await vi.waitFor(() => expect(submitSpy).toHaveBeenCalledTimes(1));
    expect(submitSpy).toHaveBeenCalledWith({
      name: 'Alice',
      email: 'a@example.com',
      message: 'Hello there',
      website: '',
      turnstileToken: 'test-token'
    });
    await vi.waitFor(() => expect(screen.getByTestId('contact-form-success')).toBeInTheDocument());
  });
});
