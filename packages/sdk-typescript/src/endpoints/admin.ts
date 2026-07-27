/**
 * Admin endpoints: /admin/users
 */

import type { AutoSdkClient } from "../client";
import type { ListAdminUsersParams, ListAdminUsersResponse } from "../types";

export class AdminModule {
  constructor(private readonly client: AutoSdkClient) {}

  /** GET /admin/users */
  listUsers(params: ListAdminUsersParams = {}): Promise<ListAdminUsersResponse> {
    return this.client.request<ListAdminUsersResponse>("GET", "/admin/users", {
      query: params,
    });
  }
}
