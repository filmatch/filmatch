// src/services/SwipeService.ts
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  serverTimestamp,
  query,
  where,
  getDocs,
  limit
} from 'firebase/firestore';

export class SwipeService {
  private static db = getFirestore();

  /**
   * Record a like (right swipe)
   * Returns true if it's a mutual match, false otherwise
   */
  static async recordLike(userId: string, targetUserId: string): Promise<boolean> {
    try {
      // Store the like in swipes collection
      const swipeRef = doc(this.db, 'swipes', `${userId}_${targetUserId}`);
      await setDoc(swipeRef, {
        userId,
        targetUserId,
        action: 'like',
        timestamp: serverTimestamp(),
      });

      console.log(`Like recorded: ${userId} -> ${targetUserId}`);

      // Check if the other user already liked this user
      const reverseSwipeRef = doc(this.db, 'swipes', `${targetUserId}_${userId}`);
      const reverseSwipe = await getDoc(reverseSwipeRef);

      if (reverseSwipe.exists() && reverseSwipe.data().action === 'like') {
        console.log(`🎉 MUTUAL MATCH! ${userId} <-> ${targetUserId}`);
        
        // Store the match in matches collection
        await this.createMatch(userId, targetUserId);
        
        return true; // It's a match!
      }

      return false; // Not a match yet
    } catch (error) {
      console.error('Error recording like:', error);
      return false;
    }
  }

  /**
   * Record a pass (left swipe)
   */
  static async recordPass(userId: string, targetUserId: string): Promise<void> {
    try {
      const swipeRef = doc(this.db, 'swipes', `${userId}_${targetUserId}`);
      await setDoc(swipeRef, {
        userId,
        targetUserId,
        action: 'pass',
        timestamp: serverTimestamp(),
      });

      console.log(`Pass recorded: ${userId} -x-> ${targetUserId}`);
    } catch (error) {
      console.error('Error recording pass:', error);
    }
  }

  /**
   * Create a match document (only called when mutual like is detected)
   */
  private static async createMatch(user1Id: string, user2Id: string): Promise<void> {
    try {
      // Create consistent match ID (alphabetically sorted)
      const sortedIds = [user1Id, user2Id].sort();
      const matchId = `match_${sortedIds[0]}_${sortedIds[1]}`;

      // Check if match already exists
      const matchRef = doc(this.db, 'matches', matchId);
      const existingMatch = await getDoc(matchRef);

      if (existingMatch.exists()) {
        console.log('Match already exists, skipping creation');
        return;
      }

      // Create match document
      await setDoc(matchRef, {
        users: sortedIds,
        user1Id: sortedIds[0],
        user2Id: sortedIds[1],
        createdAt: serverTimestamp(),
        chatId: `chat_${sortedIds[0]}_${sortedIds[1]}`,
      });

      console.log(`Match created: ${matchId}`);
    } catch (error) {
      console.error('Error creating match:', error);
    }
  }

  /**
   * Check if two users have already matched
   */
  static async hasMatch(user1Id: string, user2Id: string): Promise<boolean> {
    try {
      const sortedIds = [user1Id, user2Id].sort();
      const matchId = `match_${sortedIds[0]}_${sortedIds[1]}`;
      
      const matchRef = doc(this.db, 'matches', matchId);
      const matchDoc = await getDoc(matchRef);
      
      return matchDoc.exists();
    } catch (error) {
      console.error('Error checking match:', error);
      return false;
    }
  }

  /**
   * Check if user has already swiped on target
   */
  static async hasSwipedOn(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const swipeRef = doc(this.db, 'swipes', `${userId}_${targetUserId}`);
      const swipeDoc = await getDoc(swipeRef);
      
      return swipeDoc.exists();
    } catch (error) {
      console.error('Error checking swipe:', error);
      return false;
    }
  }

  /**
   * Get all matches for a user
   */
  static async getUserMatches(userId: string): Promise<string[]> {
    try {
      const matchesRef = collection(this.db, 'matches');
      
      // Query matches where user is either user1 or user2
      const q1 = query(matchesRef, where('user1Id', '==', userId));
      const q2 = query(matchesRef, where('user2Id', '==', userId));
      
      const [snapshot1, snapshot2] = await Promise.all([
        getDocs(q1),
        getDocs(q2)
      ]);
      
      const matchedUserIds: string[] = [];
      
      snapshot1.forEach(doc => {
        const data = doc.data();
        matchedUserIds.push(data.user2Id);
      });
      
      snapshot2.forEach(doc => {
        const data = doc.data();
        matchedUserIds.push(data.user1Id);
      });
      
      return matchedUserIds;
    } catch (error) {
      console.error('Error getting user matches:', error);
      return [];
    }
  }
}