// Wraps flow calls so failures reach the UI as readable messages
// instead of generic 500 responses.
export async function toFlowResult<T>(
  run: () => Promise<T>,
): Promise<{ ok: true; data: T } | { ok: false; message: string }> {
  try {
    return { ok: true, data: await run() };
  } catch (error) {
    console.error(error);
    const message =
      error instanceof Error && error.message
        ? error.message
        : "Algo deu errado. Tente novamente em instantes.";
    return { ok: false, message };
  }
}
