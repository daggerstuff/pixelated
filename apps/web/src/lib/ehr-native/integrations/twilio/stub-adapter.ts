/**
 * Stub Twilio adapter — in-memory simulation for development and testing.
 *
 * @file Following the clearinghouse stub-adapter pattern: implements the
 *       TwilioAdapter interface with deterministic responses based on input.
 *       No real network calls are made. State is maintained in Maps.
 */

import type {
  TwilioAdapter,
  ListMessagesParams,
  ListCallsParams,
  ListPhoneNumbersParams,
  SendMessageInput,
  MakeCallInput,
  PaginatedResponse,
} from './adapter';
import type {
  TwilioAccount,
  TwilioMessage,
  TwilioCall,
  TwilioPhoneNumber,
} from './types';

/**
 * In-memory stub implementation of the Twilio adapter.
 *
 * Generates deterministic test data based on input parameters.
 * All responses match the Zod schemas defined in types.ts.
 */
export class StubTwilioAdapter implements TwilioAdapter {
  readonly name = 'stub-twilio';

  private readonly messages: Map<string, TwilioMessage> = new Map();
  private readonly calls: Map<string, TwilioCall> = new Map();
  private readonly phoneNumbers: Map<string, TwilioPhoneNumber> = new Map();
  private idCounter = 0;

  constructor() {
    this.seedTestData();
  }

  /**
   * Pre-populate with deterministic test data.
   */
  private seedTestData(): void {
    const message1: TwilioMessage = {
      sid: 'SMstub-message-001',
      body: 'Your appointment is confirmed for June 15 at 10:00 AM.',
      from: '+15551234567',
      to: '+15559876543',
      status: 'delivered',
      dateSent: '2025-06-01T12:00:00.000Z',
      dateCreated: '2025-06-01T12:00:00.000Z',
      dateUpdated: '2025-06-01T12:00:05.000Z',
      direction: 'outbound-api',
      price: '-0.00750',
    };
    this.messages.set(message1.sid, message1);

    const message2: TwilioMessage = {
      sid: 'SMstub-message-002',
      body: 'Reply YES to confirm, NO to cancel.',
      from: '+15559876543',
      to: '+15551234567',
      status: 'received',
      dateSent: '2025-06-01T12:05:00.000Z',
      dateCreated: '2025-06-01T12:05:00.000Z',
      dateUpdated: '2025-06-01T12:05:00.000Z',
      direction: 'inbound-api',
    };
    this.messages.set(message2.sid, message2);

    const call1: TwilioCall = {
      sid: 'CAstub-call-001',
      from: '+15551234567',
      to: '+15559876543',
      status: 'completed',
      duration: '180',
      startTime: '2025-06-15T10:00:00.000Z',
      endTime: '2025-06-15T10:03:00.000Z',
      dateCreated: '2025-06-15T10:00:00.000Z',
      dateUpdated: '2025-06-15T10:03:00.000Z',
      direction: 'outbound-api',
      price: '-0.01500',
    };
    this.calls.set(call1.sid, call1);

    const call2: TwilioCall = {
      sid: 'CAstub-call-002',
      from: '+15559876543',
      to: '+15551234567',
      status: 'no-answer',
      duration: '0',
      startTime: '2025-06-16T14:00:00.000Z',
      endTime: '2025-06-16T14:00:30.000Z',
      dateCreated: '2025-06-16T14:00:00.000Z',
      dateUpdated: '2025-06-16T14:00:30.000Z',
      direction: 'inbound-api',
    };
    this.calls.set(call2.sid, call2);

    const phoneNumber1: TwilioPhoneNumber = {
      sid: 'PNstub-phone-001',
      phoneNumber: '+15551234567',
      friendlyName: 'Therapy Clinic Main Line',
      capabilities: {
        voice: true,
        sms: true,
        mms: true,
        fax: false,
      },
      dateCreated: '2025-01-01T00:00:00.000Z',
      dateUpdated: '2025-01-01T00:00:00.000Z',
    };
    this.phoneNumbers.set(phoneNumber1.sid, phoneNumber1);
  }

  private nextId(prefix: string): string {
    this.idCounter += 1;
    return `${prefix}-${this.idCounter.toString().padStart(3, '0')}`;
  }

  async getAccount(accessToken: string, accountSid: string): Promise<TwilioAccount> {
    if (!accessToken) {
      throw new Error('StubTwilioAdapter: accessToken is required');
    }
    if (!accountSid) {
      throw new Error('StubTwilioAdapter: accountSid is required');
    }
    return {
      sid: accountSid,
      friendlyName: 'Stub Therapy Clinic Account',
      status: 'active',
      type: 'Full',
      dateCreated: '2025-01-01T00:00:00.000Z',
      dateUpdated: '2025-06-01T00:00:00.000Z',
    };
  }

  async listMessages(
    _accessToken: string,
    params?: ListMessagesParams,
  ): Promise<PaginatedResponse<TwilioMessage>> {
    let items = [...this.messages.values()];
    if (params?.to) {
      items = items.filter((m) => m.to === params.to);
    }
    if (params?.from) {
      items = items.filter((m) => m.from === params.from);
    }
    if (params?.dateSent) {
      items = items.filter((m) => m.dateSent?.startsWith(params.dateSent!));
    }
    return {
      data: items,
      pagination: { count: items.length },
    };
  }

  async getMessage(
    _accessToken: string,
    messageSid: string,
  ): Promise<TwilioMessage> {
    const message = this.messages.get(messageSid);
    if (!message) {
      throw new Error(`StubTwilioAdapter: message not found: ${messageSid}`);
    }
    return message;
  }

  async sendMessage(
    _accessToken: string,
    data: SendMessageInput,
  ): Promise<TwilioMessage> {
    const sid = `SM${this.nextId('stub-message')}`;
    const message: TwilioMessage = {
      sid,
      body: data.body,
      from: data.from,
      to: data.to,
      status: 'queued',
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      direction: 'outbound-api',
    };
    this.messages.set(sid, message);
    return message;
  }

  async listCalls(
    _accessToken: string,
    params?: ListCallsParams,
  ): Promise<PaginatedResponse<TwilioCall>> {
    let items = [...this.calls.values()];
    if (params?.to) {
      items = items.filter((c) => c.to === params.to);
    }
    if (params?.from) {
      items = items.filter((c) => c.from === params.from);
    }
    if (params?.status) {
      items = items.filter((c) => c.status === params.status);
    }
    if (params?.startTime) {
      items = items.filter((c) => c.startTime?.startsWith(params.startTime!));
    }
    return {
      data: items,
      pagination: { count: items.length },
    };
  }

  async getCall(
    _accessToken: string,
    callSid: string,
  ): Promise<TwilioCall> {
    const call = this.calls.get(callSid);
    if (!call) {
      throw new Error(`StubTwilioAdapter: call not found: ${callSid}`);
    }
    return call;
  }

  async makeCall(
    _accessToken: string,
    data: MakeCallInput,
  ): Promise<TwilioCall> {
    const sid = `CA${this.nextId('stub-call')}`;
    const call: TwilioCall = {
      sid,
      from: data.from,
      to: data.to,
      status: 'queued',
      dateCreated: new Date().toISOString(),
      dateUpdated: new Date().toISOString(),
      direction: 'outbound-api',
    };
    this.calls.set(sid, call);
    return call;
  }

  async getPhoneNumber(
    _accessToken: string,
    phoneNumberSid: string,
  ): Promise<TwilioPhoneNumber> {
    const phoneNumber = this.phoneNumbers.get(phoneNumberSid);
    if (!phoneNumber) {
      throw new Error(`StubTwilioAdapter: phone number not found: ${phoneNumberSid}`);
    }
    return phoneNumber;
  }

  async listPhoneNumbers(
    _accessToken: string,
    params?: ListPhoneNumbersParams,
  ): Promise<PaginatedResponse<TwilioPhoneNumber>> {
    let items = [...this.phoneNumbers.values()];
    if (params?.phoneNumber) {
      items = items.filter((p) => p.phoneNumber === params.phoneNumber);
    }
    if (params?.friendlyName) {
      items = items.filter((p) => p.friendlyName === params.friendlyName);
    }
    return {
      data: items,
      pagination: { count: items.length },
    };
  }
}

/**
 * Singleton stub instance for development and testing.
 */
export const stubTwilioAdapter = new StubTwilioAdapter();
