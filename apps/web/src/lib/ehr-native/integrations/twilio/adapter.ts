/**
 * Twilio adapter interface — the contract for Twilio API interactions.
 *
 * @file Following the clearinghouse adapter pattern, this interface defines
 *       the operations the Twilio service needs. A stub adapter provides
 *       in-memory simulation for development/testing, while a production
 *       adapter would make real HTTP calls to the Twilio API.
 */

import type {
  TwilioAccount,
  TwilioMessage,
  TwilioCall,
  TwilioPhoneNumber,
} from './types';

/**
 * Parameters for listing messages.
 */
export interface ListMessagesParams {
  to?: string;
  from?: string;
  dateSent?: string;
  pageSize?: number;
  pageToken?: string;
}

/**
 * Parameters for listing calls.
 */
export interface ListCallsParams {
  to?: string;
  from?: string;
  startTime?: string;
  status?: string;
  pageSize?: number;
  pageToken?: string;
}

/**
 * Parameters for listing phone numbers.
 */
export interface ListPhoneNumbersParams {
  phoneNumber?: string;
  friendlyName?: string;
  pageSize?: number;
  pageToken?: string;
}

/**
 * Input for sending a new message.
 */
export interface SendMessageInput {
  to: string;
  from: string;
  body: string;
  mediaUrl?: string;
}

/**
 * Input for making a new call.
 */
export interface MakeCallInput {
  to: string;
  from: string;
  url: string;
  timeout?: number;
  method?: 'GET' | 'POST';
}

/**
 * Paginated response wrapper for Twilio API list endpoints.
 */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    count: number;
    nextPageToken?: string;
  };
}

/**
 * Adapter contract for Twilio API operations.
 *
 * Implementations MUST:
 * - Validate all API responses with Zod schemas before returning
 * - Handle rate limiting (429) with exponential backoff
 * - Return typed results matching the domain types
 * - Throw on authentication failures (401/403) with descriptive messages
 */
export interface TwilioAdapter {
  /** Adapter identifier — 'twilio' for production, 'stub-twilio' for stub. */
  readonly name: string;

  /**
   * Retrieve the account details for the given account SID.
   * @see https://www.twilio.com/docs/usage/api/account
   */
  getAccount(accessToken: string, accountSid: string): Promise<TwilioAccount>;

  /**
   * List messages for an account.
   * @see https://www.twilio.com/docs/sms/api/message-resource
   */
  listMessages(
    accessToken: string,
    params?: ListMessagesParams,
  ): Promise<PaginatedResponse<TwilioMessage>>;

  /**
   * Retrieve a single message by SID.
   * @see https://www.twilio.com/docs/sms/api/message-resource
   */
  getMessage(accessToken: string, messageSid: string): Promise<TwilioMessage>;

  /**
   * Send a new message.
   * @see https://www.twilio.com/docs/sms/api/message-resource
   */
  sendMessage(accessToken: string, data: SendMessageInput): Promise<TwilioMessage>;

  /**
   * List calls for an account.
   * @see https://www.twilio.com/docs/voice/api/call-resource
   */
  listCalls(
    accessToken: string,
    params?: ListCallsParams,
  ): Promise<PaginatedResponse<TwilioCall>>;

  /**
   * Retrieve a single call by SID.
   * @see https://www.twilio.com/docs/voice/api/call-resource
   */
  getCall(accessToken: string, callSid: string): Promise<TwilioCall>;

  /**
   * Make a new call.
   * @see https://www.twilio.com/docs/voice/api/call-resource
   */
  makeCall(accessToken: string, data: MakeCallInput): Promise<TwilioCall>;

  /**
   * Retrieve a phone number by SID.
   * @see https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
   */
  getPhoneNumber(
    accessToken: string,
    phoneNumberSid: string,
  ): Promise<TwilioPhoneNumber>;

  /**
   * List phone numbers for an account.
   * @see https://www.twilio.com/docs/phone-numbers/api/incomingphonenumber-resource
   */
  listPhoneNumbers(
    accessToken: string,
    params?: ListPhoneNumbersParams,
  ): Promise<PaginatedResponse<TwilioPhoneNumber>>;
}
