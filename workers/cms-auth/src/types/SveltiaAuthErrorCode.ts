/**
 * Error codes the OAuth callback page sends to Sveltia in its
 * `authorization:github:error:` message.
 *
 * All but `UserNotAllowed` are Sveltia's own codes: Sveltia shows its
 * translated `sign_in_error.<code>` text for them, and sveltia-cms-auth sends
 * the same codes (`errorMessages` in
 * https://github.com/sveltia/sveltia-cms-auth/blob/main/src/index.js).
 * `UserNotAllowed` is specific to this Worker; Sveltia has no text for it,
 * so it shows the message's `error` text instead.
 */
export enum SveltiaAuthErrorCode {
  AuthCodeRequestFailed = 'AUTH_CODE_REQUEST_FAILED',
  CsrfDetected = 'CSRF_DETECTED',
  TokenRequestFailed = 'TOKEN_REQUEST_FAILED',
  UserNotAllowed = 'USER_NOT_ALLOWED'
}
