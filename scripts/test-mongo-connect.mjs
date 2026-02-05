import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const uri = process.env.MONGODB_URI;
console.log('Testing connection to:', uri ? uri.replace(/:([^:@]+)@/, ':****@') : 'undefined');

if (!uri) {
    console.error('MONGODB_URI is undefined');
    process.exit(1);
}

// Minimal options to test default behavior
const client = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
});

async function run() {
    try {
        console.log('Connecting...');
        await client.connect();
        console.log('Connected successfully to server');
        await client.db("pixelated_empathy").command({ ping: 1 });
        console.log("Ping successful");
    } catch (err) {
        console.error('Connection failed:', err);
    } finally {
        await client.close();
    }
}

void run();
