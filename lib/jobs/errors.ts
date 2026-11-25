// Map stable database error codes; never return raw database error text.
export function scheduleError(code?: string): string {
  switch (code) {
    case "40001":
      return "This job changed. Reopen it before saving.";
    case "42501":
      return "Only an administrator can schedule and assign moves.";
    case "23505":
      return "This move already has a job. Check Jobs & schedule before retrying.";
    case "22023":
      return "Check the accepted estimate, date, arrival window, and worker/truck availability. Assignments must not overlap another job.";
    default:
      return "The save could not be confirmed. Check Jobs & schedule before retrying.";
  }
}
