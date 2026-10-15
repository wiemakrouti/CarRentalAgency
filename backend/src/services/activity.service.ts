import { can, type ActivityQuery, type Role } from '@car-rental/shared';
import { ActivityRepository } from '../repositories/activity.repository.js';

// The activity journal. The director (`audit.view`) reads the whole agency
// and may filter by member; anyone else only ever gets their own actions —
// whatever `userId` they ask for.
export const ActivityService = {
  async list(agencyId: string, actor: { id: string; role: Role }, query: ActivityQuery) {
    const scoped = can(actor.role, 'audit.view') ? query : { ...query, userId: actor.id };
    const { items, total } = await ActivityRepository.findPage(agencyId, scoped);
    return {
      items: items.map((row) => ({
        id: row.id,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        before: row.previousValues,
        after: row.newValues,
        createdAt: row.createdAt,
        actor: row.user,
      })),
      total,
      page: query.page,
      pageSize: query.pageSize,
    };
  },
};
