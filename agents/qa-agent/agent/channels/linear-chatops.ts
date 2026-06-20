// Linear chatops channel for the QA agent.
// Trainers can delegate work to the agent in Linear; eve receives the agent
// session event and the QA agent replies with native Linear Agent Activities.

import { linearChannel } from "eve/channels/linear";

export default linearChannel({
  credentials: {
    accessToken: process.env.LINEAR_AGENT_ACCESS_TOKEN,
    webhookSecret: process.env.LINEAR_WEBHOOK_SECRET,
  },
});
