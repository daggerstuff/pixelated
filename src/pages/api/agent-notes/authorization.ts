import type { NoteTurn } from "../../../lib/agent-note-collab";

export type ActorIdentity = {
  actorId?: string;
  role?: string;
  hasPrivilege: boolean;
};

const PRIVILEGED_ROLES = new Set(["admin"]);

export function resolveActorIdentity(
  locals?: Partial<{
    user?: {
      id?: string | null;
      role?: string | null;
    };
  }>,
): ActorIdentity {
  const actorId = locals?.user?.id?.trim();
  const role = locals?.user?.role?.trim();
  return {
    actorId: actorId || undefined,
    role,
    hasPrivilege: role ? PRIVILEGED_ROLES.has(role) : false,
  };
}

export function hasArtifactTurnAccess(
  turnsForArtifact: NoteTurn[],
  actorId?: string,
  hasPrivilege = false,
) {
  if (hasPrivilege) {
    return true;
  }

  if (!actorId) {
    return false;
  }

  return turnsForArtifact.some((turn) => turn.agentId === actorId);
}

export function filterTurnsByActorArtifactAccess(turns: NoteTurn[], actorId?: string) {
  if (!actorId) {
    return turns;
  }

  const accessibleArtifactIds = new Set<string>();
  for (const turn of turns) {
    if (turn.agentId === actorId) {
      accessibleArtifactIds.add(turn.artifactId);
    }
  }

  return turns.filter((turn) => accessibleArtifactIds.has(turn.artifactId));
}
