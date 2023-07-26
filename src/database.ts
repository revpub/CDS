import { Database } from './types'; // this is the Database interface we defined earlier
import { Pool } from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import * as dotenv from "dotenv";

dotenv.config({ path: __dirname+'/.env' });

const dialect = new PostgresDialect({
  pool: new Pool({
    host: process.env.HOST,
    database: process.env.DATABASE_NAME,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    port: Number(process.env.DATABASE_PORT),
    max: 10,
  })
})

// Database interface is passed to Kysely's constructor, and from now on, Kysely 
// knows your database structure.
// Dialect is passed to Kysely's constructor, and from now on, Kysely knows how 
// to communicate with your database.
export const db = new Kysely<Database>({
  dialect,
})