/**
 * User endpoints: /profile, /preferences
 */

import type { AutoSdkClient } from "../client";
import type {
  UserPreferences,
  UserPreferencesResponse,
  UserPreferencesUpdate,
  UserProfile,
  UserProfileResponse,
  UserProfileUpdate,
} from "../types";

export class UserModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** GET /profile */
  getProfile(): Promise<UserProfile> {
    return this.client.request<UserProfileResponse>("GET", "/profile").then((r) => r.profile);
  }

  /** PUT /profile */
  updateProfile(updates: UserProfileUpdate): Promise<UserProfile> {
    return this.client
      .request<UserProfileResponse>("PUT", "/profile", { body: updates })
      .then((r) => r.profile);
  }

  /** GET /preferences */
  getPreferences(): Promise<UserPreferences> {
    return this.client
      .request<UserPreferencesResponse>("GET", "/preferences")
      .then((r) => r.preferences);
  }

  /** PUT /preferences */
  updatePreferences(updates: UserPreferencesUpdate): Promise<UserPreferences> {
    return this.client
      .request<UserPreferencesResponse>("PUT", "/preferences", {
        body: updates,
      })
      .then((r) => r.preferences);
  }
}
