import { GitHubProvider } from "./github.js";

export class AnthropicsProvider extends GitHubProvider {
  constructor() {
    super("anthropics", "skills", {
      name: "anthropics",
      displayName: "Anthropic Official",
      branch: "main",
    });
  }
}
