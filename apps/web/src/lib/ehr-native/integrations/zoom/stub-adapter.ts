/**
 * Stub Zoom adapter — in-memory simulation for development and testing.
 *
 * @file Following the clearinghouse stub-adapter pattern: implements the
 *       ZoomAdapter interface with deterministic responses based on input.
 *       No real network calls are made. State is maintained in Maps.
 */

import type {
  ZoomAdapter,
  ListMeetingsParams,
  ListRecordingsParams,
  CreateMeetingInput,
  UpdateMeetingInput,
  PaginatedResponse,
} from './adapter'
import type { ZoomUser, ZoomMeeting, ZoomRecording } from './types'

/**
 * In-memory stub implementation of the Zoom adapter.
 *
 * Generates deterministic test data based on input parameters.
 * All responses match the Zod schemas defined in types.ts.
 */
export class StubZoomAdapter implements ZoomAdapter {
  readonly name = 'stub-zoom'

  private readonly meetings: Map<string, ZoomMeeting> = new Map()
  private readonly recordings: Map<string, ZoomRecording> = new Map()
  private idCounter = 0

  constructor() {
    this.seedTestData()
  }

  /**
   * Pre-populate with deterministic test data.
   */
  private seedTestData(): void {
    const meeting1: ZoomMeeting = {
      id: 100000001,
      topic: 'Therapy Session - Initial Consultation',
      type: 2,
      start_time: '2025-06-15T10:00:00.000Z',
      duration: 45,
      timezone: 'America/New_York',
      join_url: 'https://zoom.us/j/100000001?pwd=stubpassword1',
      start_url: 'https://zoom.us/s/100000001?zak=stubzak1',
      password: 'stubpassword1',
      agenda: 'Initial therapy consultation and assessment',
      host_id: 'stub-host-001',
      created_at: '2025-06-01T00:00:00.000Z',
      updated_at: '2025-06-01T00:00:00.000Z',
      settings: {
        host_video: true,
        participant_video: true,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        auto_recording: 'cloud',
      },
    }
    this.meetings.set(String(meeting1.id), meeting1)

    const meeting2: ZoomMeeting = {
      id: 100000002,
      topic: 'Group Therapy Session',
      type: 2,
      start_time: '2025-06-20T14:00:00.000Z',
      duration: 60,
      timezone: 'America/New_York',
      join_url: 'https://zoom.us/j/100000002?pwd=stubpassword2',
      start_url: 'https://zoom.us/s/100000002?zak=stubzak2',
      password: 'stubpassword2',
      agenda: 'Weekly group therapy session',
      host_id: 'stub-host-001',
      created_at: '2025-06-05T00:00:00.000Z',
      updated_at: '2025-06-05T00:00:00.000Z',
      settings: {
        host_video: true,
        participant_video: false,
        join_before_host: false,
        mute_upon_entry: true,
        waiting_room: true,
        auto_recording: 'none',
      },
    }
    this.meetings.set(String(meeting2.id), meeting2)

    const recording1: ZoomRecording = {
      id: 'stub-recording-001',
      meeting_id: meeting1.id,
      topic: meeting1.topic,
      start_time: '2025-06-15T10:00:00.000Z',
      duration: 45,
      recording_files: [
        {
          id: 'stub-file-001',
          meeting_id: meeting1.id,
          recording_start: '2025-06-15T10:00:00.000Z',
          recording_end: '2025-06-15T10:45:00.000Z',
          file_type: 'MP4',
          file_size: 150000000,
          play_url: 'https://zoom.us/rec/play/stub-play-001',
          download_url: 'https://zoom.us/rec/download/stub-download-001',
          status: 'completed',
          recording_type: 'speaker_view',
        },
      ],
      share_url: 'https://zoom.us/rec/share/stub-share-001',
      password: 'stubrecpass1',
      host_id: 'stub-host-001',
      account_id: 'stub-account-001',
      created_at: '2025-06-15T10:45:00.000Z',
      updated_at: '2025-06-15T10:45:00.000Z',
    }
    this.recordings.set(recording1.id, recording1)
  }

  private nextId(prefix: string): string {
    this.idCounter += 1
    return `${prefix}-${this.idCounter.toString().padStart(3, '0')}`
  }

  async getCurrentUser(accessToken: string): Promise<ZoomUser> {
    if (!accessToken) {
      throw new Error('StubZoomAdapter: accessToken is required')
    }
    return {
      id: 'stub-user-001',
      first_name: 'Dr. Stub',
      last_name: 'User',
      email: 'stub@example.com',
      type: 1,
      timezone: 'America/New_York',
      account_id: 'stub-account-001',
      pmi: '100000000',
      use_pmi: false,
      personal_meeting_url: 'https://zoom.us/j/100000000',
      verified: true,
      status: 'active',
      created_at: '2025-01-01T00:00:00.000Z',
      last_login_time: '2025-06-01T00:00:00.000Z',
    }
  }

  async listMeetings(
    _accessToken: string,
    params?: ListMeetingsParams,
  ): Promise<PaginatedResponse<ZoomMeeting>> {
    let items = [...this.meetings.values()]
    if (params?.type) {
      // Zoom meeting type 2 = scheduled; stub treats all as scheduled
      if (params.type === 'scheduled') {
        items = items.filter((m) => m.type === 2)
      } else if (params.type === 'live') {
        items = items.filter((m) => m.type === 1)
      } else if (params.type === 'upcoming') {
        items = items.filter((m) => m.type === 2)
      }
    }
    return {
      data: items,
      pagination: { count: items.length },
    }
  }

  async getMeeting(
    _accessToken: string,
    meetingId: string,
  ): Promise<ZoomMeeting> {
    const meeting = this.meetings.get(meetingId)
    if (!meeting) {
      throw new Error(`StubZoomAdapter: meeting not found: ${meetingId}`)
    }
    return meeting
  }

  async createMeeting(
    _accessToken: string,
    meetingData: CreateMeetingInput,
  ): Promise<ZoomMeeting> {
    const id = this.nextId('meeting')
    const numericId = 200000000 + this.idCounter
    const meeting: ZoomMeeting = {
      id: numericId,
      topic: meetingData.topic,
      type: meetingData.type,
      start_time: meetingData.start_time,
      duration: meetingData.duration,
      timezone: meetingData.timezone,
      join_url: `https://zoom.us/j/${numericId}?pwd=${meetingData.password ?? 'stubpass'}`,
      start_url: `https://zoom.us/s/${numericId}?zak=stubzak${id}`,
      password: meetingData.password,
      agenda: meetingData.agenda,
      host_id: 'stub-host-001',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      settings: meetingData.settings
        ? {
            host_video: meetingData.settings.host_video,
            participant_video: meetingData.settings.participant_video,
            join_before_host: meetingData.settings.join_before_host,
            mute_upon_entry: meetingData.settings.mute_upon_entry,
            waiting_room: meetingData.settings.waiting_room,
            auto_recording: meetingData.settings.auto_recording,
          }
        : undefined,
    }
    this.meetings.set(String(meeting.id), meeting)
    return meeting
  }

  async updateMeeting(
    _accessToken: string,
    meetingId: string,
    updates: UpdateMeetingInput,
  ): Promise<void> {
    const meeting = this.meetings.get(meetingId)
    if (!meeting) {
      throw new Error(`StubZoomAdapter: meeting not found: ${meetingId}`)
    }
    const updated: ZoomMeeting = {
      ...meeting,
      topic: updates.topic ?? meeting.topic,
      type: updates.type ?? meeting.type,
      start_time: updates.start_time ?? meeting.start_time,
      duration: updates.duration ?? meeting.duration,
      timezone: updates.timezone ?? meeting.timezone,
      password: updates.password ?? meeting.password,
      agenda: updates.agenda ?? meeting.agenda,
      settings: updates.settings
        ? {
            host_video: updates.settings.host_video,
            participant_video: updates.settings.participant_video,
            join_before_host: updates.settings.join_before_host,
            mute_upon_entry: updates.settings.mute_upon_entry,
            waiting_room: updates.settings.waiting_room,
            auto_recording: updates.settings.auto_recording,
          }
        : meeting.settings,
      updated_at: new Date().toISOString(),
    }
    this.meetings.set(meetingId, updated)
  }

  async deleteMeeting(_accessToken: string, meetingId: string): Promise<void> {
    if (!this.meetings.has(meetingId)) {
      throw new Error(`StubZoomAdapter: meeting not found: ${meetingId}`)
    }
    this.meetings.delete(meetingId)
  }

  async listRecordings(
    _accessToken: string,
    params?: ListRecordingsParams,
  ): Promise<PaginatedResponse<ZoomRecording>> {
    let items = [...this.recordings.values()]
    if (params?.from) {
      items = items.filter((r) => r.start_time >= params.from!)
    }
    if (params?.to) {
      items = items.filter((r) => r.start_time <= params.to!)
    }
    return {
      data: items,
      pagination: { count: items.length },
    }
  }
}

/**
 * Singleton stub instance for development and testing.
 */
const stubZoomAdapter = new StubZoomAdapter()
