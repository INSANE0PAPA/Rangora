export type RangoraRole = "participant" | "organizer" | "admin";

export function canBookAsRole(roles: readonly string[]): boolean {
  return roles.includes("participant") && !roles.includes("organizer") && !roles.includes("admin");
}

export function canManageEvents(roles: readonly string[], approval: string | null | undefined): boolean {
  return roles.includes("admin") || (roles.includes("organizer") && approval === "approved");
}

export function hasAdminInviteProfile(profile: { status?: string } | null | undefined): boolean {
  return profile?.status === "pending";
}

export function canActivateAdminInvite(profile: { status?: string } | null | undefined, emailConfirmed: boolean, inviteMatches: boolean): boolean {
  return profile?.status === "pending" && emailConfirmed && inviteMatches;
}

export function canSubmitEventReview(
  registered: boolean,
  eventHasEnded: boolean,
  attendanceVerified: boolean
): boolean {
  return registered && eventHasEnded && attendanceVerified;
}

export function canChangeEventPublishing(roles: readonly string[], ownerId: string | null, userId: string): boolean {
  return roles.includes("admin") || (roles.includes("organizer") && ownerId === userId);
}