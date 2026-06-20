# Recovery procedures

When a tool call returns an error, the orchestrator follows the
recovery contract in the table below.

| Stage             | Retry policy                                                |
| ----------------- | ----------------------------------------------------------- |
| Dataset Curation  | retry once after 5 minutes; on failure post to Slack + hold |
| Training Launch   | retry twice; on second failure post to Slack + hold         |
| Training Monitor  | resume on transient errors; on hard failure -> FAILED       |
| Evaluation        | retry once; on second failure post to Slack + hold          |
| Staging Deploy    | retry once with exponential backoff; on failure -> `FAILED` |
| Smoke Test        | rerun; on second failure ask operator to abort or ignore    |
| Production Deploy | abort on any error and emit `pipeline_event=deploy_aborted` |

Each retry emits a `pipeline_event=retry` with the tool name, attempt
number, and error class. After the retries are exhausted, the
orchestrator transitions to `FAILED` and posts the full stack trace
the program can grep later.
