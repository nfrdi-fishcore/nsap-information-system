/**
 * Analytics Cache Utility
 * Provides caching functionality for analytics data to reduce database queries
 */

class AnalyticsCache {
    constructor() {
        this.cache = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default TTL
        this.maxCacheSize = 100; // Maximum number of cached entries
    }

    /**
     * Generate cache key from parameters
     * @param {string} method - Service method name
     * @param {Array} args - Method arguments
     * @returns {string} Cache key
     */
    generateKey(method, args) {
        // Normalize arguments for consistent keys
        const normalized = args.map(arg => {
            if (arg instanceof Date) {
                return arg.toISOString().split('T')[0]; // Normalize dates to YYYY-MM-DD
            }
            return arg === null || arg === undefined ? 'null' : String(arg);
        });
        return `${method}:${normalized.join(':')}`;
    }

    /**
     * Get cached data if available and not expired
     * @param {string} key - Cache key
     * @returns {Object|null} Cached data or null if not found/expired
     */
    get(key) {
        const entry = this.cache.get(key);
        
        if (!entry) {
            return null;
        }

        // Check if expired
        const now = Date.now();
        if (now - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }

        // Return deep copy to prevent cache mutation
        return JSON.parse(JSON.stringify(entry.data));
    }

    /**
     * Store data in cache
     * @param {string} key - Cache key
     * @param {Object} data - Data to cache
     * @param {number} ttl - Time to live in milliseconds (optional)
     */
    set(key, data, ttl = null) {
        // Enforce max cache size (LRU eviction)
        if (this.cache.size >= this.maxCacheSize) {
            // Remove oldest entry
            const oldestKey = this.cache.keys().next().value;
            this.cache.delete(oldestKey);
        }

        this.cache.set(key, {
            data: JSON.parse(JSON.stringify(data)), // Deep copy
            timestamp: Date.now(),
            ttl: ttl || this.defaultTTL
        });
    }

    /**
     * Clear specific cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
    }

    /**
     * Clear cache entries matching a pattern
     * @param {string} pattern - Pattern to match (e.g., 'getCatchTrends')
     */
    clearPattern(pattern) {
        for (const key of this.cache.keys()) {
            if (key.startsWith(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    /**
     * Get cache statistics
     * @returns {Object} Cache statistics
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        for (const entry of this.cache.values()) {
            if (now - entry.timestamp > entry.ttl) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        }

        return {
            total: this.cache.size,
            valid: validEntries,
            expired: expiredEntries,
            maxSize: this.maxCacheSize
        };
    }

    /**
     * Clean expired entries
     */
    cleanExpired() {
        const now = Date.now();
        for (const [key, entry] of this.cache.entries()) {
            if (now - entry.timestamp > entry.ttl) {
                this.cache.delete(key);
            }
        }
    }
}

// Create singleton instance
const analyticsCache = new AnalyticsCache();

// Auto-clean expired entries every minute
if (typeof window !== 'undefined') {
    setInterval(() => {
        analyticsCache.cleanExpired();
    }, 60 * 1000); // Every minute
}

// Make available globally
if (typeof window !== 'undefined') {
    window.AnalyticsCache = analyticsCache;
}

