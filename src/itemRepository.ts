import { sql, expressionBuilder } from 'kysely';
import { db } from './database';
import { ItemUpdate, Item, NewItem } from './types';

interface DB {
  item: {
    content: string
  }
}

export async function createItemTable() {
  const eb = expressionBuilder<DB, 'item'>();
  return await db.schema.createTable('item')
    .addColumn('id', 'serial', (cb) => cb.primaryKey())
    .addColumn('content', 'varchar', (cb) => cb.notNull())
    .addColumn('created_at', 'timestamp', (cb) =>
      cb.notNull().defaultTo(sql`now()`)
    )
    .execute();
}

export async function findItemById(id: number) {
  return await db.selectFrom('item')
    .where('id', '=', id)
    .selectAll()
    .executeTakeFirst()
}

export async function findItems(criteria: Partial<Item>) {
  let query = db.selectFrom('item')

  if (criteria.id) {
    query = query.where('id', '=', criteria.id) // Kysely is immutable, you must re-assign!
  }

  if (criteria.created_at) {
    query = query.where('created_at', '=', criteria.created_at)
  }

  return await query.selectAll().execute()
}

export async function updateItem(id: number, updateWith: ItemUpdate) {
  await db.updateTable('item').set(updateWith).where('id', '=', id).execute()
}

export async function createItem(item: NewItem) {
  return await db.insertInto('item')
    .values(item)
    .execute();
    // .returningAll()
    // .executeTakeFirstOrThrow()
}

export async function deleteItem(id: number) {
  return await db.deleteFrom('item').where('id', '=', id)
    .returningAll()
    .executeTakeFirst()
}