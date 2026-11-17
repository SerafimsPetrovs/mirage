/** Runs once when a server instance starts: the background job worker (music rendering, AI clips). */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startJobs } = await import("./lib/job-handlers");
    startJobs();
  }
}
