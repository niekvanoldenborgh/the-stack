// Typed API error. `status` is the HTTP status to send, `code` is a stable
// machine-readable string the client can switch on (the UI spec's Callout
// copy is keyed off these), `message` is the plain-English sentence.
export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
