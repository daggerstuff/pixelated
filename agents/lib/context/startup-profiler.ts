/**
 * Local-dev re-export stub for the agent tree.
 *
 * Each eve-authored agent (`agents/<name>/agent/agent.ts`) imports the
 * startup profiler via a relative path:
 *
 *   `from '../../lib/context/startup-profiler.js'`
 *
 * At local-dev time this resolves to `agents/lib/context/startup-profiler.ts`
 * (this file). At Docker build time `agents/Dockerfile` `COPY`s
 * `src/lib/context` into `/agent/lib/context`, so this stub is shadowed by
 * the real implementation and never executes at runtime.
 *
 * Behavior in the container is therefore identical to `src/lib/context/
 * startup-profiler.ts` — there is no schema or behavioral drift. We use
 * `export *` (rather than named re-exports) so any future export added to
 * the upstream module is also available locally without re-editing this
 * stub.
 */
export * from '../../../apps/web/src/lib/context/startup-profiler.js'
