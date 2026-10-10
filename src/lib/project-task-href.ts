// Plain (non-"use client") module so both Server and Client Components can call it.

/** Page of a project task in Srijan, or null when the project or code is unknown. */
export function projectTaskHref(projectId?: string | null, code?: string | null): string | null {
  return projectId && code ? `/projects/${projectId}/tasks/${encodeURIComponent(code)}` : null;
}
