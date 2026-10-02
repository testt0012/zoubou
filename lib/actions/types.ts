// What an admin action reports back, so the screen can say when something
// didn't work instead of looking as if it had.
export interface ActionResult {
  success: boolean;
  error?: string;
}
