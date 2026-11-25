import type { Metadata } from "next";
import View from "./availability-form";
import { workerWorkspace } from "@/lib/workers/data";
import { WorkerLoadError } from "@/app/worker/worker-ui";
export default async function Page() {
  const workspace = await workerWorkspace();
  if (workspace.error) return <WorkerLoadError />;
  return <View {...workspace} />;
}

export const metadata: Metadata = { title: "Availability" };
