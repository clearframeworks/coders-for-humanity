/** A successful read is a prerequisite, not proof of email delivery or write access. */
export async function accountDataAvailable(
  probe: () => PromiseLike<{ error: unknown }>,
): Promise<boolean> {
  try {
    const result = await probe();
    return !result.error;
  } catch {
    return false;
  }
}

export function githubAuthEnabled(value: string | undefined): boolean {
  return value === "true";
}
