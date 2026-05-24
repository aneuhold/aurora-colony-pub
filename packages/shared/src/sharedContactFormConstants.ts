/**
 * Field-length limits the contact Worker enforces during validation,
 * mirrored to the ContactForm island so the client can apply `maxlength`
 * attributes and validate eagerly before posting. The Worker still
 * re-checks every value — it remains the source of truth.
 */
export const sharedContactFormConstants = {
  minNameLength: 1,
  maxNameLength: 100,
  minEmailLength: 5,
  maxEmailLength: 254,
  minMessageLength: 1,
  maxMessageLength: 5000
};
