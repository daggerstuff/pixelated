#!/usr/bin/env python
from __future__ import annotations

import argparse
import base64
import json
import re
import sys
from dataclasses import dataclass
from urllib.request import Request, urlopen


@dataclass(frozen=True)
class LightningStudioContext:
  username: str
  teamspace: str
  project_id: str
  studio: str
  owner_type: str


def _read_credentials(path: str) -> tuple[str, str]:
  with open(path, "r", encoding="utf-8") as file:
    data: dict[str, str] = json.load(file)
  return data.get("user_id", ""), data.get("api_key", "")


def _api_get(base_url: str, auth: str, path: str) -> dict:
  request = Request(f"{base_url}{path}")
  request.add_header("Authorization", f"Basic {auth}")
  with urlopen(request, timeout=30) as response:
    return json.loads(response.read().decode("utf-8"))


def _matches_machine_alias(name: str, machine: str) -> bool:
  normalized_name = name.lower()
  normalized_machine = re.sub(r"[^a-z0-9]", "", machine.lower())

  if not normalized_machine:
    return False

  if normalized_machine.startswith("h100"):
    aliases = ["h100", "p5"]
  elif normalized_machine.startswith("a100"):
    aliases = ["a100", "p4d"]
  elif normalized_machine.startswith("l40s"):
    aliases = ["l40s", "g6", "g6e", "g6n"]
  elif normalized_machine.startswith("l4"):
    aliases = ["l4", "g4", "g5"]
  elif normalized_machine.startswith("h200"):
    aliases = ["h200", "p5en"]
  elif normalized_machine.startswith("t4"):
    aliases = ["t4", "g4dn", "g4"]
  elif normalized_machine.startswith("cpu"):
    aliases = ["cpu", "data_prep"]
  else:
    aliases = [normalized_machine]

  return any(alias in normalized_name for alias in aliases)


def _has_gpu_hint(name: str) -> bool:
  normalized_name = name.lower()
  return any(token in normalized_name for token in ("gpu", "l4", "l40", "h100", "h200", "a100", "p4", "p5", "g4", "g6", "g7", "t4"))


def resolve_lightning_context(creds_path: str, require_studio: bool, preferred_machine: str = "") -> LightningStudioContext:
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
  owner_type = str(default_membership.get("ownerType", "")).strip()
  if not project_id or not teamspace:
    raise RuntimeError("Unable to resolve Lightning teamspace.")

  studio_name = ""
  if require_studio:
    cloudspaces: list[dict] = _api_get(base_url, auth, f"/v1/projects/{project_id}/cloudspaces?userId={owner_id}").get(
      "cloudspaces",
      [],
    )
    if not cloudspaces:
      raise RuntimeError(f"No studios found for teamspace '{teamspace}'.")

    ready = [space for space in cloudspaces if space.get("state") == "CLOUD_SPACE_STATE_READY"]
    studio_data = None
    if preferred_machine:
      for space in ready:
        if _matches_machine_alias(str(space.get("name", "")).strip(), preferred_machine):
          studio_data = space
          break
    if studio_data is None:
      studio_data = next((space for space in ready if _has_gpu_hint(str(space.get("name", "")))), None)
    if studio_data is None:
      if preferred_machine and not _has_gpu_hint(preferred_machine):
        studio_data = ready[0] if ready else cloudspaces[0]
      else:
        raise RuntimeError(
          f"Could not find a GPU studio in teamspace '{teamspace}'. Set LIGHTNING_STUDIO explicitly."
        )
    studio_name = str(studio_data.get("name", "")).strip()
    if not studio_name:
      raise RuntimeError(f"Invalid studio response for teamspace '{teamspace}'.")

  return LightningStudioContext(
    username=username,
    teamspace=teamspace,
    project_id=project_id,
    studio=studio_name,
    owner_type=owner_type,
  )


def main() -> None:
  parser = argparse.ArgumentParser()
  parser.add_argument("--creds-path", required=True)
  parser.add_argument("--require-studio", action="store_true", help="Resolve and include an available studio.")
  parser.add_argument("--machine", default="", help="Prefer a studio matching this machine class.")
  parser.add_argument(
    "--format",
    choices=["json", "lines"],
    default="json",
    help="Output format for resolved context.",
  )
  args = parser.parse_args()

  try:
    context = resolve_lightning_context(args.creds_path, require_studio=args.require_studio, preferred_machine=args.machine)
    values = {
      "username": context.username,
      "teamspace": context.teamspace,
      "project_id": context.project_id,
      "studio": context.studio,
      "owner_type": context.owner_type,
    }
    if args.format == "json":
      print(json.dumps(values))
    else:
      print(
        f"{values['username']}\n"
        f"{values['teamspace']}\n"
        f"{values['project_id']}\n"
        f"{values['studio']}\n"
        f"{values['owner_type']}"
      )
  except Exception as exc:
    print(f"ERROR: {exc}", file=sys.stderr)
    raise SystemExit(1)


if __name__ == "__main__":
  main()
