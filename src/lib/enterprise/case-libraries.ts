/**
 * Enterprise case libraries — Stage 10.
 * Versioning · publishing · approval. Never mutates Case Engine catalogue ownership;
 * references scenario_template_slug only.
 */

import type {
  CaseLibrary,
  CaseLibraryEntry,
  LibraryKind,
  LibraryVisibility,
} from "@/lib/enterprise/types";

export function createLibrary(input: {
  id?: string;
  organization_id: string | null;
  slug: string;
  title: string;
  kind: LibraryKind;
  visibility?: LibraryVisibility;
}): CaseLibrary {
  return {
    id: input.id ?? `lib_${input.organization_id ?? "platform"}_${input.slug}`,
    organization_id: input.organization_id,
    slug: input.slug,
    title: input.title,
    kind: input.kind,
    visibility: input.visibility ?? "organization",
    version: 1,
    approval_status: "draft",
    entry_count: 0,
  };
}

export function addLibraryEntry(
  library: CaseLibrary,
  input: {
    id?: string;
    scenario_template_slug: string;
    title: string;
  },
): { library: CaseLibrary; entry: CaseLibraryEntry } {
  if (library.approval_status === "approved" && library.visibility === "shared") {
    // Shared approved libraries require a new draft version before mutation.
    library = {
      ...library,
      version: library.version + 1,
      approval_status: "draft",
    };
  }
  const entry: CaseLibraryEntry = {
    id: input.id ?? `entry_${library.id}_${input.scenario_template_slug}`,
    library_id: library.id,
    organization_id: library.organization_id,
    scenario_template_slug: input.scenario_template_slug,
    title: input.title,
    version: 1,
    published: false,
  };
  return {
    library: { ...library, entry_count: library.entry_count + 1 },
    entry,
  };
}

export function submitForApproval(library: CaseLibrary): CaseLibrary {
  if (library.entry_count < 1) {
    throw new Error("Cannot submit empty library");
  }
  return { ...library, approval_status: "pending" };
}

export function approveLibrary(library: CaseLibrary): CaseLibrary {
  if (library.approval_status !== "pending") {
    throw new Error("Library must be pending approval");
  }
  return {
    ...library,
    approval_status: "approved",
    version: library.version + 1,
  };
}

export function rejectLibrary(library: CaseLibrary): CaseLibrary {
  return { ...library, approval_status: "rejected" };
}

export function publishEntry(entry: CaseLibraryEntry): CaseLibraryEntry {
  return { ...entry, published: true, version: entry.version + 1 };
}

/** Visibility gate — private libraries never cross tenants. */
export function canReadLibrary(
  library: CaseLibrary,
  actorOrganizationId: string | null,
  isPlatformAdmin: boolean,
): boolean {
  if (isPlatformAdmin) return true;
  if (library.visibility === "platform" || library.visibility === "shared") {
    return library.approval_status === "approved";
  }
  if (library.visibility === "private" || library.visibility === "organization") {
    return library.organization_id === actorOrganizationId;
  }
  return false;
}
