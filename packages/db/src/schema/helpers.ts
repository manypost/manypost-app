import { customType, timestamp, uuid } from 'drizzle-orm/pg-core';
import { uuidv7 } from '../uuid';

export const pk = () => uuid('id').primaryKey().$defaultFn(uuidv7);

export const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

/** Colunas cifradas (AES-256-GCM: nonce||ciphertext||tag — SPEC_DATA §5). */
export const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType: () => 'bytea',
});
