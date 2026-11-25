import "server-only";
import { requireRole } from "@/lib/auth/account";
import { serverSupabase } from "@/lib/supabase/server";
import { logFailure } from "@/lib/server-log";
import { tripDays, type CalendarJob, type CalendarResource } from "./calendar";
import { longDistanceReady } from "./progress-data";
import { schedulingReady, travelHelper } from "./schedule-options";
import { addressPoint, tightTravel, type SavedDayJob } from "./travel";

// PostgREST caps individual responses. Page every ordered query so busy weeks are not truncated.
async function allRows<T>(
  read: (
    from: number,
    to: number,
  ) => PromiseLike<{ data: T[] | null; error: unknown }>,
) {
  const rows: T[] = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await read(from, from + 499);
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < 500) return rows;
  }
}
export async function calendarData(start: string, end: string) {
  await requireRole("admin");
  const empty = {
    jobs: [] as CalendarJob[],
    workers: [] as CalendarResource[],
    trucks: [] as CalendarResource[],
  };
  try {
    const client = await serverSupabase();
    // Phase 9: trips can start up to 30 days before the week and still be away.
    const trips = await longDistanceReady();
    const earliest = trips
      ? new Date(Date.parse(`${start}T12:00:00Z`) - 30 * 86400000)
          .toISOString()
          .slice(0, 10)
      : start;
    const [loaded, workers, trucks] = await Promise.all([
      allRows((from, to) =>
        client
          .from("jobs")
          .select(
            "*,move_requests(pickup_address,destination_address,profiles(full_name)),trucks(name),job_workers(worker_id,profiles(full_name))",
          )
          .gte("scheduled_date", earliest)
          .lte("scheduled_date", end)
          .in("status", ["scheduled", "in-progress", "completed"])
          .order("scheduled_date")
          .order("start_time")
          .order("id")
          .range(from, to),
      ),
      allRows((from, to) =>
        client
          .from("profiles")
          .select("id,full_name,active")
          .eq("role", "worker")
          .order("full_name")
          .order("id")
          .range(from, to),
      ),
      allRows((from, to) =>
        client
          .from("trucks")
          .select("id,name,active")
          .order("name")
          .order("id")
          .range(from, to),
      ),
    ]);
    // Same-day jobs in the week, and trips with any day in the week.
    const lastDay = (j: (typeof loaded)[number]) =>
      ("return_date" in j && j.return_date) || j.scheduled_date;
    const jobs = loaded.filter((j) => lastDay(j) >= start);
    const isTrip = (j: (typeof loaded)[number]) =>
      "return_date" in j && Boolean(j.return_date);
    const calendarJobs = jobs.flatMap((j): CalendarJob[] => {
      if (
        !["scheduled", "in-progress", "completed"].includes(j.status) ||
        !j.move_requests
      )
        throw new Error("Invalid calendar record");
      const job: CalendarJob = {
        id: j.id,
        date: j.scheduled_date,
        start: j.start_time.slice(0, 5),
        end: j.end_time.slice(0, 5),
        arrivalStart: j.arrival_start.slice(0, 5),
        arrivalEnd: j.arrival_end.slice(0, 5),
        status: j.status as CalendarJob["status"],
        customer: j.move_requests.profiles?.full_name.trim() || "Customer",
        truckId: j.truck_id,
        truck: j.trucks?.name || "Assigned truck",
        workers: j.job_workers.map((w) => ({
          id: w.worker_id,
          name: w.profiles?.full_name.trim() || "Assigned worker",
        })),
      };
      if (!isTrip(j))
        return j.scheduled_date >= start && j.scheduled_date <= end
          ? [job]
          : [];
      return tripDays(
        {
          date: j.scheduled_date,
          endDate: j.end_date ?? j.scheduled_date,
          returnDate: j.return_date!,
        },
        start,
        end,
      ).map(({ date, trip }) => ({
        ...job,
        date,
        // Later days sort first in their cell and show the trip instead of times.
        start: date === j.scheduled_date ? job.start : "00:00",
        trip,
      }));
    });
    // Flag saved back-to-back jobs that break the travel-time rule (Phase 7B).
    const travel = (await schedulingReady())
      ? await travelHelper(client)
      : null;
    if (travel) {
      const saved = new Map<string, SavedDayJob[]>();
      for (const j of jobs) {
        // Travel between same-day neighbours only; trips block whole days.
        if (isTrip(j) || j.scheduled_date < start) continue;
        const pickup = addressPoint(j.move_requests?.pickup_address),
          destination = addressPoint(j.move_requests?.destination_address);
        const day = saved.get(j.scheduled_date) ?? [];
        day.push({
          id: j.id,
          start: j.start_time.slice(0, 5),
          end: j.end_time.slice(0, 5),
          truckId: j.truck_id,
          workerIds: j.job_workers.map((w) => w.worker_id),
          pickupZip: pickup.zip,
          destinationZip: destination.zip,
          pickupPlace: pickup.place,
          destinationPlace: destination.place,
        });
        saved.set(j.scheduled_date, day);
      }
      for (const day of saved.values())
        for (const [id, message] of tightTravel(day, travel.minutesBetween)) {
          const job = calendarJobs.find((c) => c.id === id);
          if (job) job.travelWarning = message;
        }
    }
    return {
      error: false,
      data: {
        jobs: calendarJobs,
        workers: workers.map((w) => ({
          id: w.id,
          name: w.full_name.trim() || "Worker",
          active: w.active,
        })),
        trucks: trucks.map((t) => ({ ...t, name: t.name || "Truck" })),
      },
    };
  } catch (error) {
    logFailure("calendar:load", error);
    return { data: empty, error: true };
  }
}
