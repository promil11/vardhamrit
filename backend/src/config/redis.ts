import Redis from 'ioredis';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const redisHost = process.env.REDIS_HOST || '127.0.0.1';
const redisPort = Number(process.env.REDIS_PORT) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisEnabled = process.env.REDIS_ENABLED !== 'false';

let redisClient: Redis | null = null;

if (redisEnabled) {
  try {
    redisClient = new Redis({
      host: redisHost,
      port: redisPort,
      password: redisPassword,
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
      },
    });

    redisClient.on('connect', () => {
      console.log(`⚡ Redis connected successfully on ${redisHost}:${redisPort}`);
    });

    redisClient.on('error', (err) => {
      console.warn(`⚠️ Redis error (continuing without cache): ${err.message}`);
    });

    redisClient.connect().catch((err) => {
      console.warn(`⚠️ Redis initial connect failed (continuing without cache): ${err.message}`);
    });
  } catch (err) {
    console.warn(`⚠️ Could not initialize Redis client:`, err);
    redisClient = null;
  }
}

export { redisClient };

/**
 * High-performance Cache Wrapper
 * Automatically handles serialization, error recovery, and TTL (in seconds)
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetchFn: () => Promise<T>
): Promise<T> {
  if (!redisClient || redisClient.status !== 'ready') {
    return await fetchFn();
  }

  try {
    const cached = await redisClient.get(key);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch (err) {
    console.warn(`Cache get failed for ${key}:`, err);
  }

  const freshData = await fetchFn();

  if (redisClient && redisClient.status === 'ready' && freshData !== undefined) {
    try {
      await redisClient.setex(key, ttlSeconds, JSON.stringify(freshData));
    } catch (err) {
      console.warn(`Cache set failed for ${key}:`, err);
    }
  }

  return freshData;
}

/**
 * Cache Invalidation Helper by pattern or key
 */
export async function invalidateCachePattern(pattern: string): Promise<void> {
  if (!redisClient || redisClient.status !== 'ready') return;
  try {
    const keys = await redisClient.keys(pattern);
    if (keys.length > 0) {
      await redisClient.del(...keys);
      console.log(`🧹 Invalidate cache pattern "${pattern}" purged ${keys.length} keys`);
    }
  } catch (err) {
    console.warn(`Cache invalidate pattern error:`, err);
  }
}
