import he from 'he';
import { contactWorkerConstants } from '../util/contactWorkerConstants';

interface TurnstileVerifyResponse {
  success: boolean;
}

/**
 * Thin wrapper around the two external APIs the contact handler depends on:
 * Cloudflare Turnstile (captcha verification) and Resend (email delivery).
 * Keeps `ContactService` focused on request orchestration.
 */
class ContactEmailService {
  /**
   * Verifies a Turnstile token against Cloudflare's siteverify endpoint.
   *
   * @param token Turnstile token submitted by the form
   * @param secret Worker secret key for the widget
   * @param ip Visitor IP (`CF-Connecting-IP`)
   */
  async verifyTurnstileToken(token: string, secret: string, ip: string): Promise<boolean> {
    const formData = new FormData();
    formData.append('secret', secret);
    formData.append('response', token);
    formData.append('remoteip', ip);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData
    });
    if (!response.ok) return false;
    const data = await response.json<TurnstileVerifyResponse>();
    return data.success;
  }

  /**
   * Sends the contact email through Resend. Returns true on a 2xx response;
   * the caller propagates a 5xx if false so the form can surface a
   * retry-friendly error.
   *
   * @param payload Validated form fields
   * @param payload.name the sender's name, included in the email body and subject for context
   * @param payload.email the sender's email, included in the email body and `Reply-To` header so the recipient can respond
   * @param payload.message the sender's message, included in the email body
   * @param ip Visitor IP, included in the email body for context
   * @param resendApiKey Resend API key from the worker env
   */
  async sendContactEmail(
    payload: {
      name: string;
      email: string;
      message: string;
    },
    ip: string,
    resendApiKey: string
  ): Promise<boolean> {
    const subject = `New contact form message from ${payload.name}`;
    const textBody = [
      `Name: ${payload.name}`,
      `Email: ${payload.email}`,
      `IP: ${ip}`,
      '',
      payload.message
    ].join('\n');
    const htmlBody = `
<!doctype html>
<html><body>
<p><strong>Name:</strong> ${he.escape(payload.name)}</p>
<p><strong>Email:</strong> ${he.escape(payload.email)}</p>
<p><strong>IP:</strong> ${he.escape(ip)}</p>
<hr />
<p style="white-space:pre-wrap">${he.escape(payload.message)}</p>
</body></html>`.trim();
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${resendApiKey}`
      },
      body: JSON.stringify({
        from: contactWorkerConstants.fromEmail,
        to: [contactWorkerConstants.ownerEmail],
        reply_to: payload.email,
        subject,
        text: textBody,
        html: htmlBody
      })
    });
    return response.ok;
  }
}

const contactEmailService = new ContactEmailService();
export default contactEmailService;
