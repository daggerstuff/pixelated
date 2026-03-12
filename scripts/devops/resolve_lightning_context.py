#!/usr/bin/env python
from __future__ import annotations

import argparse
import base64
import json
from dataclasses import dataclass
from typing import Dict, List
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class LightningStudioContext:
  username: str
  teamspace: str
  studio: str


def _read_credentials(path: str) -> tuple[str, str]:
  with open(path, "r", encoding="utf-8") as file:
    data: Dict[str, str] = json.load(file)
  return data.get("user_id", ""), data.get("api_key", "")


def _api_get(base_url: str, auth: str, path: str) -> Dict:
  request = Request(f"{base_url}{path}")
  request.add_header("Authorization", f"Basic {auth}")
  with urlopen(request, timeout=30) as response:
    return json.loads(response.read().decode("utf-8"))


def resolve_lightning_context(creds_path: str) -> LightningStudioContext:
  base_url = "https://lightning.ai"
  user_id, api_key = _read_credentials(creds_path)
  if not user_id or not api_key:
    raise RuntimeError("Missing Lightning credentials.")

  auth = base64.b64encode(f"{user_id}:{api_key}".encode("utf-8")).decode("utf-8")

  auth_user = _api_get(base_url, auth, "/v1/auth/user")
  username = str(auth_user.get("username", "")).strip()
  memberships = _api_get(base_url, auth, "/v1/memberships?filterByUserId=True").get("memberships", [])
  if not memberships:
    raise RuntimeError("No Lightning memberships found for authenticated user.")

  default_membership = next((m for m in memberships if m.get("isDefault")), memberships[0])
  project_id = str(default_membership.get("projectId", "")).strip()
  teamspace = str(default_membership.get("name", "")).strip()
  owner_id = str(default_membership.get("ownerId", "")).strip()
  if not project_id or not teamspace:
    raise RuntimeError("Unable to resolve Lightning teamspace.")

  cloudspaces: List[Dict] = _api_get(base_url, auth, f"/v1/projects/{project_id}/cloudspaces?userId={owner_id}").get(
    "cloudspaces",
    [],
  )
  if not cloudspaces:
    raise RuntimeError(f"No studios found for teamspace '{teamspace}'.")

  ready = [space for space in cloudspaces if space.get("state") == "CLOUD_SPACE_STATE_READY"]
  studio_data = ready[0] if ready else cloudspaces[0]
  studio_name = str(studio_data.get("name", "")).strip()
  if not studio_name:
    raise RuntimeError(f"Invalid studio response for teamspace '{teamspace}'.")

  return LightningStudioContext(username=username, teamspace=teamspace, studio=studio_name)


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--creds-path", required=True)
  args = parser.parse_args()

  context = resolve_lightning_context(args.creds_path)
  print(f"{context.username}|{context.teamspace}|{context.studio}")


if __name__ == "__main__":
  main()
