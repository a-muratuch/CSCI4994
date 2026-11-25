// Shared success flag and feedback for server actions; payload fields stay typed.
export type ActionResult<T extends object = object> = T & {
  ok: boolean;
  message?: string;
};
