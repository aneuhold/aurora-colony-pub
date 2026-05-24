import { describe, expect, it } from 'vitest';
import { contactWorkerConstants } from './util/contactWorkerConstants';

const WORKER_URL = 'https://aurora-contact.agneuhold.workers.dev';

describe('contact e2e', () => {
  it('returns 204 on OPTIONS /', async () => {
    const response = await fetch(`${WORKER_URL}/`, {
      method: 'OPTIONS',
      headers: { Origin: contactWorkerConstants.allowedOrigins[0] }
    });
    expect(response.status).toBe(204);
  });
});
