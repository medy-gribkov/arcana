import { GitHubProvider } from "./github.js";

export class ArcanaProvider extends GitHubProvider {
  constructor() {
    super("medy-gribkov", "arcana", {
      name: "arcana",
      displayName: "Arcana (official)",
      branch: "master",
    });
  }
}
