export function getErrorMessage(
  error: unknown,
  fallback = "An error occurred"
): string {
  return error instanceof Error ? error.message : fallback
}

export function isAuthError(message: string): boolean {
  return message.includes("Not authenticated")
}
