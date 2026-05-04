import { initLogger } from "braintrust"

export const logger = initLogger({
  projectName: "linkedin-post-project",
  apiKey: process.env.BRAINTRUST_API_KEY,
  asyncFlush: true,
})
