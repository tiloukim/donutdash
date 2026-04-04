// Default menu template for new donut shops
// No prices or images — shop owners set their own

export interface TemplateItem {
  name: string
  description: string
  category: 'donuts' | 'coffee' | 'breakfast' | 'drinks' | 'other'
  is_featured: boolean
  sort_order: number
  variants?: { name: string; options: string[] }[] | null
}

export const menuTemplate: TemplateItem[] = [
  // ── DONUTS ──
  { name: 'Glazed', description: 'Classic ring donut with a sweet glaze.', category: 'donuts', is_featured: true, sort_order: 1 },
  { name: 'Chocolate Frosted', description: 'Rich chocolate frosting on a soft raised donut.', category: 'donuts', is_featured: true, sort_order: 2 },
  { name: 'Strawberry Sprinkle', description: 'Strawberry frosted donut topped with rainbow sprinkles.', category: 'donuts', is_featured: false, sort_order: 3 },
  { name: 'Boston Cream', description: 'Custard-filled donut topped with rich chocolate ganache.', category: 'donuts', is_featured: true, sort_order: 4 },
  { name: 'Maple Bar', description: 'Long bar donut with sweet maple glaze.', category: 'donuts', is_featured: false, sort_order: 5 },
  { name: 'Apple Fritter', description: 'Crispy fried dough with chunks of real apple and cinnamon glaze.', category: 'donuts', is_featured: true, sort_order: 6 },
  { name: 'Old Fashioned', description: 'Dense, craggy cake donut with a sweet glaze.', category: 'donuts', is_featured: false, sort_order: 7 },
  { name: 'Jelly Filled', description: 'Soft donut filled with sweet jelly, dusted with powdered sugar.', category: 'donuts', is_featured: false, sort_order: 8 },
  { name: 'Cinnamon Sugar', description: 'Warm cake donut rolled in cinnamon sugar.', category: 'donuts', is_featured: false, sort_order: 9 },
  { name: 'Donut Holes 6-pack', description: 'Six bite-sized glazed donut holes.', category: 'donuts', is_featured: false, sort_order: 10 },
  { name: 'Half Dozen Glazed', description: 'Six glazed donuts at a great value.', category: 'donuts', is_featured: true, sort_order: 11 },
  { name: 'Dozen Glazed Box', description: 'A full dozen classic glazed donuts.', category: 'donuts', is_featured: true, sort_order: 12 },

  // ── COFFEE ──
  { name: 'Drip Coffee', description: 'Fresh brewed house coffee.', category: 'coffee', is_featured: false, sort_order: 1, variants: [{ name: 'Size', options: ['Small', 'Medium', 'Large'] }] },
  { name: 'Iced Coffee', description: 'Chilled drip coffee served over ice.', category: 'coffee', is_featured: true, sort_order: 2, variants: [{ name: 'Size', options: ['Medium', 'Large'] }] },
  { name: 'Latte', description: 'Espresso with steamed milk.', category: 'coffee', is_featured: true, sort_order: 3, variants: [{ name: 'Size', options: ['Small', 'Large'] }] },
  { name: 'Cappuccino', description: 'Espresso with equal parts steamed milk and foam.', category: 'coffee', is_featured: false, sort_order: 4 },
  { name: 'Cold Brew', description: 'Slow-steeped cold brew coffee. Bold and smooth.', category: 'coffee', is_featured: false, sort_order: 5, variants: [{ name: 'Size', options: ['Medium', 'Large'] }] },
  { name: 'Hot Chocolate', description: 'Rich chocolate with steamed milk and whipped cream.', category: 'coffee', is_featured: false, sort_order: 6 },

  // ── BREAKFAST ──
  { name: 'Breakfast Sandwich', description: 'Egg, cheese, and choice of meat on a toasted croissant.', category: 'breakfast', is_featured: true, sort_order: 1, variants: [{ name: 'Meat', options: ['Bacon', 'Sausage', 'Ham'] }] },
  { name: 'Kolache Sausage', description: 'Pastry stuffed with savory sausage and cheese.', category: 'breakfast', is_featured: false, sort_order: 2 },
  { name: 'Kolache Cream Cheese', description: 'Sweet pastry filled with cream cheese.', category: 'breakfast', is_featured: false, sort_order: 3 },
  { name: 'Croissant', description: 'Buttery, flaky croissant baked fresh daily.', category: 'breakfast', is_featured: false, sort_order: 4 },
  { name: 'Bagel & Cream Cheese', description: 'Toasted bagel with a generous spread of cream cheese.', category: 'breakfast', is_featured: false, sort_order: 5 },

  // ── DRINKS ──
  { name: 'Orange Juice', description: 'Fresh-squeezed orange juice.', category: 'drinks', is_featured: false, sort_order: 1 },
  { name: 'Milk', description: 'Cold whole milk or chocolate milk.', category: 'drinks', is_featured: false, sort_order: 2, variants: [{ name: 'Type', options: ['Whole', 'Chocolate'] }] },
  { name: 'Bottled Water', description: 'Cold bottled water.', category: 'drinks', is_featured: false, sort_order: 3 },
]
