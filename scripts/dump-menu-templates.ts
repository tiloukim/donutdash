import fs from 'fs'
import { MENU_TEMPLATES } from '../lib/menu-template'

const out = MENU_TEMPLATES.map(t => ({
  id: t.id,
  name: t.name,
  description: t.description,
  items: t.items.map(i => ({
    name: i.name,
    description: i.description,
    category: i.category,
    is_featured: i.is_featured,
    variants: i.variants || null,
  })),
}))

fs.writeFileSync('/tmp/menu-templates.json', JSON.stringify(out, null, 2))
console.log(`Wrote /tmp/menu-templates.json — ${out.length} templates`)
