import { storage } from '../../tools/storage/index.js';

export class BadgeWorker {
  private USER_BADGES_COLLECTION = 'user_badges';
  private BADGES_COLLECTION = 'badges';

  async getUserBadges(userId: string) {
    // In a real system this might be a join, here we list and filter
    const allUserBadges = await storage.list(this.USER_BADGES_COLLECTION);
    const userBadgeIds = allUserBadges
      .filter(ub => ub.user_id === userId)
      .map(ub => ub.badge_id);

    const allBadges = await storage.list(this.BADGES_COLLECTION);
    return allBadges.filter(b => userBadgeIds.includes(b.id));
  }
}

export class FollowWorker {
  private FOLLOWS_COLLECTION = 'follows';

  async follow(userId: string, targetToken: string, targetName: string) {
    const id = `${userId}:${targetToken}`;
    await storage.save(this.FOLLOWS_COLLECTION, id, {
      user_id: userId,
      target_token: targetToken,
      target_name: targetName,
      created_at: new Date().toISOString()
    });
  }

  async getFollows(userId: string) {
    const allFollows = await storage.list(this.FOLLOWS_COLLECTION);
    return allFollows.filter(f => f.user_id === userId);
  }
}

export const badgeWorker = new BadgeWorker();
export const followWorker = new FollowWorker();
