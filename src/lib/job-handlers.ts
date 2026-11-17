import "server-only";
import { startWorker } from "./jobs";
// Every module that registers a job handler is imported here so the worker knows all job kinds.
import "./music";
import "./moments";

export function startJobs() {
  startWorker();
}
