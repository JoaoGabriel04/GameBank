import type { AuthUser } from "@/stores/authStore";

export function getPostAuthPath(user: AuthUser, redirect?: string | null) {
  if (!user.profileComplete) return "/onboarding";

  // Admin vai direto para o painel
  if (user.isAdmin) return "/admin";

  // Redirect personalizado (ex: voltando de página protegida)
  if (redirect && redirect.startsWith("/") && redirect !== "/onboarding") {
    // Não redirecionar para rotas de admin se não for admin
    if (!redirect.startsWith("/admin")) return redirect;
  }

  return "/user";
}
