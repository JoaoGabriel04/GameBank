import type { AuthUser } from "@/stores/authStore";

export function getPostAuthPath(user: AuthUser, redirect?: string | null) {
  if (!user.profileComplete) return "/onboarding";
  if (redirect && redirect.startsWith("/") && redirect !== "/onboarding") {
    return redirect;
  }
  return "/sessions";
}
