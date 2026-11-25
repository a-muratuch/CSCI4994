export type Profile = { name: string; email: string; phone: string };
export type RequestInput = {
  pickup: string;
  destination: string;
  requestedDate: string;
  property: string;
  size: string;
  items: string;
  access: string;
  notes: string;
};
export type MoveRequest = RequestInput & {
  id: string;
  referenceNumber?: number;
  customerId: string;
  pickupAddress?: import("../requests/address").Address;
  destinationAddress?: import("../requests/address").Address;
  revision?: number;
  requestStatus?: "pending" | "cancelled";
  /** Customer's preferred arrival window key (Phase 8D), if any. */
  preferredWindow?: string | null;
};
export type Estimate = {
  id: string;
  requestId: string;
  version?: number;
  isCurrent?: boolean;
  revision: number;
  status: "draft" | "awaiting" | "accepted" | "declined";
  lines: { label: string; amountCents: number }[];
  inclusions: string[];
  exclusions: string[];
  terms: string;
  /** Present after a customer declines with a reason (Phase 8C). */
  declineReason?: string | null;
  declineNote?: string | null;
  /** Proposed appointment shown to the customer (Phase 8E), if any. */
  proposal?: { date: string; arrivalStart: string; arrivalEnd: string } | null;
};
export type JobStatus = "scheduled" | "in-progress" | "completed" | "cancelled";
export type Job = {
  id: string;
  requestId: string;
  estimateId: string;
  date: string;
  arrival: string;
  start: string;
  end: string;
  status: JobStatus;
  revision: number;
  arrivalStart: string;
  arrivalEnd: string;
  /** Phase 9: delivery day and, for long-distance moves, the day the crew is back. */
  endDate?: string;
  returnDate?: string | null;
  /** Phase 8G: the crew marked "On the way". */
  onTheWay?: boolean;
  /** Phase 8G: an administrator allowed completion without a delivery photo. */
  photoWaived?: boolean;
  photoWaiverNote?: string | null;
};
export type Availability = {
  day: Day;
  available: boolean;
  start: string;
  end: string;
};
export type History = {
  id: string;
  entity: "request" | "estimate" | "job";
  recordId: string;
  label: string;
  date: string;
  detail: string;
};
export type EstimateInput = Pick<
  Estimate,
  "lines" | "inclusions" | "exclusions" | "terms"
>;
export type ScheduleInput = {
  date: string;
  start: string;
  end: string;
  /** Phase 9: delivery day (end applies to it) and the day the crew is back. */
  endDate?: string;
  returnDate?: string;
  arrivalStart: string;
  arrivalEnd: string;
  workerIds: string[];
  truckId: string;
};
export type MoveView = MoveRequest & {
  stage: "requested" | JobStatus;
  jobId?: string;
  appointment?: {
    date: string;
    arrival: string;
    start: string;
    end: string;
    /** Phase 9: delivery day of a long-distance move (customers never see the return day). */
    deliveryDate?: string;
  };
  team?: string[];
  /** Phase 8G: the crew marked "On the way" for this move's job. */
  crewOnTheWay?: boolean;
  history: History[];
};
export type EstimateView = Estimate & { moveId: string };
export type Day = (typeof import("./schedule").days)[number];
export type WorkerJobView = MoveRequest &
  Job & {
    customer: string;
    workerIds: string[];
    crew: string[];
    truck: string;
    history: History[];
  };
