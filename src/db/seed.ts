import { db } from '@/db/client';
import { categories } from '@/db/schema';

const defaultCategories = [
  { name: 'Personal', color: '#208AEF' },
  { name: 'Auto', color: '#F59E0B' },
  { name: 'Mortgage', color: '#8B5CF6' },
  { name: 'Credit Card', color: '#EF4444' },
  { name: 'Student', color: '#10B981' },
  { name: 'Family', color: '#EC4899' },
  { name: 'Other', color: '#6B7280' },
];

export async function seedDefaultCategories() {
  const existing = await db.select().from(categories).limit(1);
  if (existing.length > 0) return;

  await db.insert(categories).values(defaultCategories);
}
