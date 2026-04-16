import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './SupabaseService';

const QUEUE_KEY = '@vitals_fusion_offline_queue';

export interface QueuedOperation {
  id: string;
  table: string;
  operation: 'insert' | 'update';
  payload: Record<string, any>;
  timestamp: string;
  retries: number;
}

/**
 * Offline-first write-ahead queue.
 *
 * Usage:
 *   Instead of writing directly to Supabase, call:
 *     OfflineSyncService.enqueue('medication_logs', 'insert', { ... })
 *
 *   Then call OfflineSyncService.flush() when connectivity is restored.
 *
 *   In _layout.tsx, hook into NetInfo or app state to auto-flush.
 */
export class OfflineSyncService {
  private static isFlushing = false;

  /**
   * Enqueue a write operation. Falls back to local queue on network error.
   * First attempts a live write; only queues if it fails.
   */
  static async write(
    table: string,
    operation: 'insert' | 'update',
    payload: Record<string, any>,
    updateFilter?: { column: string; value: string }
  ): Promise<void> {
    try {
      await this.executeOperation(table, operation, payload, updateFilter);
    } catch (error) {
      console.warn(`[OfflineSync] Live write failed for ${table}. Queuing for later.`, error);
      await this.enqueue(table, operation, payload, updateFilter);
    }
  }

  /**
   * Execute a single write against Supabase.
   */
  private static async executeOperation(
    table: string,
    operation: 'insert' | 'update',
    payload: Record<string, any>,
    updateFilter?: { column: string; value: string }
  ): Promise<void> {
    const normalizedPayload = { ...payload };
    
    // Robust Patient ID Normalization
    if (normalizedPayload.patientId) { 
      normalizedPayload.patientid = normalizedPayload.patientId; 
      delete normalizedPayload.patientId; 
    }
    if (normalizedPayload.patient_id) { 
      normalizedPayload.patientid = normalizedPayload.patient_id; 
      delete normalizedPayload.patient_id; 
    }

    // Robust Vitals Normalization
    if (normalizedPayload.heartRate) { 
      normalizedPayload.heartrate = normalizedPayload.heartRate; 
      delete normalizedPayload.heartRate; 
    }
    if (normalizedPayload.spo2Level) {
      normalizedPayload.spo2 = normalizedPayload.spo2Level;
      delete normalizedPayload.spo2Level;
    }
    if (operation === 'insert') {
      query = supabase.from(table).insert(normalizedPayload);
    } else {
      if (!updateFilter) throw new Error('Update requires a filter');
      query = supabase.from(table).update(normalizedPayload).eq(updateFilter.column, updateFilter.value);
    }
    const { error } = await query;
    if (error) throw error;
  }

  /**
   * Add an operation to the local queue.
   */
  private static async enqueue(
    table: string,
    operation: 'insert' | 'update',
    payload: Record<string, any>,
    updateFilter?: { column: string; value: string }
  ): Promise<void> {
    const queue = await this.getQueue();
    const op: QueuedOperation = {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      table,
      operation,
      payload: updateFilter ? { ...payload, __updateFilter: updateFilter } : payload,
      timestamp: new Date().toISOString(),
      retries: 0,
    };
    queue.push(op);
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  }

  /**
   * Flush all queued operations to Supabase.
   * Call this when network connectivity is restored.
   */
  static async flush(): Promise<{ synced: number; failed: number }> {
    if (this.isFlushing) return { synced: 0, failed: 0 };
    this.isFlushing = true;

    let synced = 0;
    let failed = 0;
    const queue = await this.getQueue();
    const remaining: QueuedOperation[] = [];

    for (const op of queue) {
      try {
        const { __updateFilter, ...payload } = op.payload;
        await this.executeOperation(op.table, op.operation, payload, __updateFilter);
        synced++;
      } catch (error) {
        op.retries++;
        if (op.retries < 5) {
          remaining.push(op); // Keep in queue for retry
        } else {
          console.error(`[OfflineSync] Dropping operation after 5 retries:`, op);
          failed++;
        }
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
    this.isFlushing = false;
    console.log(`[OfflineSync] Flush complete. Synced: ${synced}, Failed: ${failed}, Remaining: ${remaining.length}`);
    return { synced, failed };
  }

  /**
   * Returns the number of operations currently queued.
   */
  static async getPendingCount(): Promise<number> {
    const queue = await this.getQueue();
    return queue.length;
  }

  /**
   * Clear all queued operations — use when schema changes make existing
   * queued payloads invalid so they don't block future syncs.
   */
  static async clearQueue(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
    console.log('[OfflineSync] Queue cleared.');
  }

  private static async getQueue(): Promise<QueuedOperation[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}
