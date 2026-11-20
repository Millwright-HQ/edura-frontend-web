export interface EventEnvelope<TPayload = unknown> {
  /** Unique event id (ULID). Consumers dedupe on this. */
  id: string;
  /** Dot-separated, past tense, e.g. `identity.user.created`. */
  type: string;
  /** Schema version of the payload. */
  version: number;
  occurredAt: string;
  tenantId?: string;
  correlationId: string;
  actorId?: string;
  payload: TPayload;
}
