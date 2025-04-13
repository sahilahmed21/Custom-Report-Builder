// backend/src/config/db.js
import { Redis } from '@upstash/redis';
import dotenv from 'dotenv';

dotenv.config();

let redis;

try {
    if (!process.env.UPSTASH_REDIS_URL || !process.env.UPSTASH_REDIS_TOKEN) {
        throw new Error('Upstash Redis URL or Token is not defined in environment variables.');
    }
    redis = new Redis({
        url: process.env.UPSTASH_REDIS_URL,
        token: process.env.UPSTASH_REDIS_TOKEN,
    });
    console.log('Connected to Upstash Redis.');
} catch (error) {
    console.error('Failed to connect to Upstash Redis:', error);
    // Depending on your error handling strategy, you might want to exit the process
    // process.exit(1);
    redis = null; // Ensure redis is null if connection fails
}

export default redis;