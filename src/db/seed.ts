import { db } from '@/db/client';
import { appSettings, categories } from '@/db/schema';

export const categoryColors = [
  '#208AEF',
  '#F59E0B',
  '#8B5CF6',
  '#EF4444',
  '#10B981',
  '#EC4899',
  '#6B7280',
];

const defaultCategories = [
  { name: 'Personal', color: categoryColors[0] },
  { name: 'Auto', color: categoryColors[1] },
  { name: 'Mortgage', color: categoryColors[2] },
  { name: 'Credit Card', color: categoryColors[3] },
  { name: 'Student', color: categoryColors[4] },
  { name: 'Family', color: categoryColors[5] },
  { name: 'Other', color: categoryColors[6] },
];

export async function seedDefaultCategories() {
  const existing = await db.select().from(categories).limit(1);
  if (existing.length > 0) return;

  await db.insert(categories).values(defaultCategories);
}

export async function seedAppSettings() {
  const existing = await db.select().from(appSettings).limit(1);
  if (existing.length > 0) return;

  await db.insert(appSettings).values({});
}
