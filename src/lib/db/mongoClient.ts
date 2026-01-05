import { mongodb } from '../../config/mongodb.config';
import type { Db } from 'mongodb';

/**
 * MongoDB Client bridge for legacy code.
 * Provides access to the database instance.
 */
class MongoClientBridge {
    public connect() {
        return mongodb.connect();
    }

    public disconnect() {
        return mongodb.disconnect();
    }

    public get db(): Db {
        return mongodb.getDb();
    }
}

export const mongoClient = new MongoClientBridge();
export default mongoClient;
