/**
 * Calendly adapter interface — the contract for Calendly API interactions.
 *
 * @file Following the clearinghouse adapter pattern, this interface defines
 *       the operations the Calendly service needs. A stub adapter provides
 *       in-memory simulation for development/testing, while a production
 *       adapter would make real HTTP calls to the Calendly API.
 */

import type { CalendlyUser, CalendlyEventType, CalendlyScheduledEvent, CalendlyInvitee } from './types';

/**
 * Parameters for listing scheduled events.
 */
export interface ListScheduledEventsParams {
  user?: string;
  status?: 'active' | 'canceled';
  min_start_time?: string;
  max_start_time?: string;
  cursor?: string;
  count?: number;
}

/**
 * Parameters for listing invitees for a scheduled event.
 */
export interface ListInviteesParams {
  status?: 'active' | 'canceled';
  cursor?: string;
  count?: number;
}

/**
 * Parameters for listing event types.
 */
export interface ListEventTypesParams {
  user?: string;
  active?: boolean;
  cursor?: string;
  count?: number;
}

/**
 * Paginated response wrapper for Calendly API list endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    count: number;
    next_page?: string;
    previous_page?: string;
  };
}

/**
 * Adapter contract for Calendly API v2 operations.
 *
 * Implementations MUST:
 * - Validate all API responses with Zod schemas before returning
 * - Handle rate limiting (429) with exponential backoff
 * - Return typed results matching the domain types
 * - Throw on authentication failures (401/403) with descriptive messages
 */
export interface CalendlyAdapter {
  /** Adapter identifier — 'calendly' for production, 'stub-calendly' for stub. */
  readonly name: string;

  /**
   * Retrieve the authenticated user's profile.
   * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-user
   */
  getCurrentUser(accessToken: string): Promise<CalendlyUser>;

  /**
   * List event types (meeting templates) for a user.
   * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/list-event-types
   */
  listEventTypes(
    accessToken: string,
    params?: ListEventTypesParams,
  ): Promise<PaginatedResponse<CalendlyEventType>>;

  /**
   * Retrieve a single scheduled event by URI.
   * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/get-event
   */
  getScheduledEvent(
    accessToken: string,
    eventUri: string,
  ): Promise<CalendlyScheduledEvent>;

  /**
   * List scheduled events for a user.
   * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/list-events
   */
  listScheduledEvents(
    accessToken: string,
    params?: ListScheduledEventsParams,
  ): Promise<PaginatedResponse<CalendlyScheduledEvent>>;

  /**
   * List invitees for a specific scheduled event.
   * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/list-event-invitees
   */
  listInvitees(
    accessToken: string,
    eventUri: string,
    params?: ListInviteesParams,
  ): Promise<PaginatedResponse<CalendlyInvitee>>;

  /**
   * Cancel a scheduled event (meeting).
   * @see https://developer.calendly.com/api-docs/v2-0-reference/rest-v2/cancel-event
   */
  cancelScheduledEvent(
    accessToken: string,
    eventUri: string,
    cancellationReason?: string,
  ): Promise<{ canceled: boolean; eventUri: string }>;
}
