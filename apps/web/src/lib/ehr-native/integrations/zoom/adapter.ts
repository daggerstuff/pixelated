/**
 * Zoom adapter interface — the contract for Zoom API interactions.
 *
 * @file Following the clearinghouse adapter pattern, this interface defines
 *       the operations the Zoom service needs. A stub adapter provides
 *       in-memory simulation for development/testing, while a production
 *       adapter would make real HTTP calls to the Zoom API.
 */

import type { ZoomUser, ZoomMeeting, ZoomRecording } from './types';

/**
 * Parameters for listing meetings.
 */
export interface ListMeetingsParams {
  type?: 'scheduled' | 'live' | 'upcoming';
  page_size?: number;
  next_page_token?: string;
}

/**
 * Parameters for listing recordings.
 */
export interface ListRecordingsParams {
  from?: string;
  to?: string;
  page_size?: number;
  next_page_token?: string;
  trash?: boolean;
}

/**
 * Input for creating a new meeting.
 */
export interface CreateMeetingInput {
  topic: string;
  type: number;
  start_time?: string;
  duration?: number;
  timezone?: string;
  password?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    auto_recording?: 'local' | 'cloud' | 'none';
  };
}

/**
 * Input for updating an existing meeting.
 */
export interface UpdateMeetingInput {
  topic?: string;
  type?: number;
  start_time?: string;
  duration?: number;
  timezone?: string;
  password?: string;
  agenda?: string;
  settings?: {
    host_video?: boolean;
    participant_video?: boolean;
    join_before_host?: boolean;
    mute_upon_entry?: boolean;
    waiting_room?: boolean;
    auto_recording?: 'local' | 'cloud' | 'none';
  };
}

/**
 * Paginated response wrapper for Zoom API list endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    count: number;
    next_page_token?: string;
  };
}

/**
 * Adapter contract for Zoom API v2 operations.
 *
 * Implementations MUST:
 * - Validate all API responses with Zod schemas before returning
 * - Handle rate limiting (429) with exponential backoff
 * - Return typed results matching the domain types
 * - Throw on authentication failures (401/403) with descriptive messages
 */
export interface ZoomAdapter {
  /** Adapter identifier — 'zoom' for production, 'stub-zoom' for stub. */
  readonly name: string;

  /**
   * Retrieve the authenticated user's profile.
   * @see https://developers.zoom.us/docs/api/rest/reference/user/methods#operation/getUser
   */
  getCurrentUser(accessToken: string): Promise<ZoomUser>;

  /**
   * List meetings for a user.
   * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/meetings
   */
  listMeetings(
    accessToken: string,
    params?: ListMeetingsParams,
  ): Promise<PaginatedResponse<ZoomMeeting>>;

  /**
   * Retrieve a single meeting by ID.
   * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/meeting
   */
  getMeeting(accessToken: string, meetingId: string): Promise<ZoomMeeting>;

  /**
   * Create a new meeting.
   * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/createMeeting
   */
  createMeeting(
    accessToken: string,
    meetingData: CreateMeetingInput,
  ): Promise<ZoomMeeting>;

  /**
   * Update an existing meeting.
   * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/updateMeeting
   */
  updateMeeting(
    accessToken: string,
    meetingId: string,
    updates: UpdateMeetingInput,
  ): Promise<void>;

  /**
   * Delete a meeting.
   * @see https://developers.zoom.us/docs/api/rest/reference/meeting/methods#operation/deleteMeeting
   */
  deleteMeeting(accessToken: string, meetingId: string): Promise<void>;

  /**
   * List cloud recordings for a user.
   * @see https://developers.zoom.us/docs/api/rest/reference/cloud-recording/methods#operation/recordingsList
   */
  listRecordings(
    accessToken: string,
    params?: ListRecordingsParams,
  ): Promise<PaginatedResponse<ZoomRecording>>;
}
