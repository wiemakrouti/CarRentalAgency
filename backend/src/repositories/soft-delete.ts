/**
 * Composed into every repository for a soft-deletable entity (Car, Client,
 * Rental, Payment, Expense, MaintenanceRecord). Keeps "exclude archived rows
 * by default" the path of least resistance instead of something each query
 * has to remember — see docs/architecture.md §1.
 *
 * Real per-model repositories (CarsRepository, ClientsRepository, ...) are
 * added starting Phase 2, each using these two helpers in their
 * findMany/findById/delete methods. Not building a fully generic
 * `BaseRepository<T>` class here on purpose — Prisma's delegate types differ
 * enough per model (relations, nested writes) that a one-size wrapper would
 * fight the type system more than it would save; a shared filter helper gets
 * the same safety without that cost.
 */

export function notDeleted<Where extends Record<string, unknown>>(
  where: Where,
  options?: { includeArchived?: boolean },
): Where & { deletedAt?: null } {
  if (options?.includeArchived) return where;
  return { ...where, deletedAt: null };
}

export function archive<Data extends Record<string, unknown> | undefined>(
  data?: Data,
): Data & { deletedAt: Date } {
  return { ...data, deletedAt: new Date() } as Data & { deletedAt: Date };
}

export function restore<Data extends Record<string, unknown> | undefined>(
  data?: Data,
): Data & { deletedAt: null } {
  return { ...data, deletedAt: null } as Data & { deletedAt: null };
}
