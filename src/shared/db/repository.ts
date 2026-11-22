import type { Table } from 'dexie'
import type { ZodType } from 'zod'
import type { RecordMetadata } from './schemas'

export function metadata(now = new Date().toISOString()): RecordMetadata {
  return { id: crypto.randomUUID(), createdAt: now, updatedAt: now, deletedAt: null }
}

export class Repository<T extends RecordMetadata> {
  constructor(private table: Table<T, string>, private schema: ZodType<T>) {}

  async create(values: Omit<T, keyof RecordMetadata>) {
    const record = this.schema.parse({ ...values, ...metadata() })
    await this.table.add(record)
    return record
  }

  async update(id: string, values: Partial<Omit<T, keyof RecordMetadata>>) {
    return this.change(id, values)
  }

  async softDelete(id: string) {
    return this.change(id, {}, new Date().toISOString())
  }

  async restore(id: string) {
    return this.change(id, {}, null)
  }

  private async change(id: string, values: Partial<Omit<T, keyof RecordMetadata>>, deletedAt?: string | null) {
    return this.table.db.transaction('rw', this.table, async () => {
      const original = await this.table.get(id)
      if (!original) throw new Error('Record not found')
      const record = this.schema.parse({
        ...original, ...values, id: original.id, createdAt: original.createdAt,
        updatedAt: new Date().toISOString(), deletedAt: deletedAt === undefined ? original.deletedAt : deletedAt,
      })
      await this.table.put(record)
      return record
    })
  }

  list() {
    return this.table.filter(record => record.deletedAt === null).toArray()
  }

  purge(now = new Date()) {
    const cutoff = now.valueOf() - 30 * 24 * 60 * 60 * 1000
    return this.table.filter(record => record.deletedAt !== null && Date.parse(record.deletedAt) < cutoff).delete()
  }
}
