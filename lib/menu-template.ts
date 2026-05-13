// Menu templates for new donut shops.
// Items have no prices or images — shop owners set their own after loading.

export interface TemplateItem {
  name: string
  description: string
  category: 'donuts' | 'coffee' | 'breakfast' | 'drinks' | 'other'
  is_featured: boolean
  sort_order: number
  variants?: { name: string; options: string[] }[] | null
}

export interface MenuTemplate {
  id: string
  name: string
  description: string
  items: TemplateItem[]
}

const classicDonutShop: TemplateItem[] = [
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

const texasDonutKolache: TemplateItem[] = [
  // ── DONUTS — Texas shops typically run a tighter donut SKU list to keep the
  // case rotating fast during the morning rush. ──
  { name: 'Glazed', description: 'Classic ring donut with a sweet glaze.', category: 'donuts', is_featured: true, sort_order: 1 },
  { name: 'Chocolate Glazed', description: 'Chocolate-glazed raised donut.', category: 'donuts', is_featured: true, sort_order: 2 },
  { name: 'Chocolate Sprinkle', description: 'Chocolate glaze topped with rainbow sprinkles.', category: 'donuts', is_featured: false, sort_order: 3 },
  { name: 'Buttermilk Bar', description: 'Dense cake-style bar with a thin glaze.', category: 'donuts', is_featured: false, sort_order: 4 },
  { name: 'Apple Fritter', description: 'Crispy fried dough with apple chunks and cinnamon glaze.', category: 'donuts', is_featured: true, sort_order: 5 },
  { name: 'Cinnamon Twist', description: 'Twisted cinnamon-sugar donut.', category: 'donuts', is_featured: false, sort_order: 6 },
  { name: 'Glazed Donut Holes', description: 'Bite-sized glazed donut holes — sold by the bag.', category: 'donuts', is_featured: false, sort_order: 7, variants: [{ name: 'Quantity', options: ['12', '24'] }] },
  { name: 'Half Dozen Glazed', description: 'Six glazed donuts at a great value.', category: 'donuts', is_featured: true, sort_order: 8 },
  { name: 'Dozen Glazed', description: 'A full dozen classic glazed donuts.', category: 'donuts', is_featured: true, sort_order: 9 },
  { name: 'Assorted Dozen', description: 'A mixed dozen — shop\'s choice of glazed, chocolate, and specialty donuts.', category: 'donuts', is_featured: true, sort_order: 10 },

  // ── KOLACHES — the headline category for Texas shops. ──
  { name: 'Sausage Kolache', description: 'Pillowy bread dough wrapped around a smoked sausage link.', category: 'breakfast', is_featured: true, sort_order: 1 },
  { name: 'Sausage & Cheese Kolache', description: 'Smoked sausage with melted cheddar inside soft kolache bread.', category: 'breakfast', is_featured: true, sort_order: 2 },
  { name: 'Jalapeño Sausage & Cheese Kolache', description: 'Spicy jalapeño, smoked sausage, and melted cheese — a Texas favorite.', category: 'breakfast', is_featured: true, sort_order: 3 },
  { name: 'Ham & Cheese Kolache', description: 'Diced ham and cheddar tucked inside soft kolache bread.', category: 'breakfast', is_featured: false, sort_order: 4 },
  { name: 'Boudin Kolache', description: 'Cajun-style boudin sausage in kolache bread.', category: 'breakfast', is_featured: false, sort_order: 5 },
  { name: 'Cream Cheese Kolache', description: 'Sweet pastry filled with cream cheese.', category: 'breakfast', is_featured: false, sort_order: 6 },
  { name: 'Fruit Kolache', description: 'Sweet pastry with fruit filling.', category: 'breakfast', is_featured: false, sort_order: 7, variants: [{ name: 'Filling', options: ['Apple', 'Cherry', 'Strawberry', 'Apricot', 'Blueberry'] }] },
  { name: 'Half Dozen Kolaches', description: 'Six kolaches — mix and match flavors.', category: 'breakfast', is_featured: true, sort_order: 8 },
  { name: 'Dozen Kolaches', description: 'A full dozen kolaches — mix and match flavors.', category: 'breakfast', is_featured: true, sort_order: 9 },

  // ── BREAKFAST TACOS — common second-tier breakfast item in East TX shops. ──
  { name: 'Bacon & Egg Taco', description: 'Scrambled egg and crispy bacon on a warm flour tortilla.', category: 'breakfast', is_featured: true, sort_order: 10 },
  { name: 'Sausage & Egg Taco', description: 'Scrambled egg with seasoned sausage on a flour tortilla.', category: 'breakfast', is_featured: false, sort_order: 11 },
  { name: 'Chorizo & Egg Taco', description: 'Spicy chorizo and scrambled egg on a flour tortilla.', category: 'breakfast', is_featured: false, sort_order: 12 },
  { name: 'Potato & Egg Taco', description: 'Crispy potato and scrambled egg on a flour tortilla.', category: 'breakfast', is_featured: false, sort_order: 13 },
  { name: 'Bean & Cheese Taco', description: 'Refried beans with melted cheese on a flour tortilla.', category: 'breakfast', is_featured: false, sort_order: 14 },

  // ── COFFEE — straightforward, the kolache run is the priority. ──
  { name: 'Drip Coffee', description: 'Fresh brewed house coffee.', category: 'coffee', is_featured: true, sort_order: 1, variants: [{ name: 'Size', options: ['Small', 'Medium', 'Large'] }] },
  { name: 'Iced Coffee', description: 'Chilled drip coffee over ice.', category: 'coffee', is_featured: false, sort_order: 2, variants: [{ name: 'Size', options: ['Medium', 'Large'] }] },
  { name: 'Hot Chocolate', description: 'Rich chocolate with steamed milk.', category: 'coffee', is_featured: false, sort_order: 3 },

  // ── DRINKS ──
  { name: 'Orange Juice', description: 'Fresh-squeezed orange juice.', category: 'drinks', is_featured: false, sort_order: 1 },
  { name: 'Bottled Water', description: 'Cold bottled water.', category: 'drinks', is_featured: false, sort_order: 2 },
  { name: 'Milk', description: 'Cold whole milk or chocolate milk.', category: 'drinks', is_featured: false, sort_order: 3, variants: [{ name: 'Type', options: ['Whole', 'Chocolate'] }] },
]

export const MENU_TEMPLATES: MenuTemplate[] = [
  {
    id: 'classic',
    name: 'Classic Donut Shop',
    description: 'Donuts, coffee, breakfast sandwiches, and drinks. The standard starter menu (~25 items).',
    items: classicDonutShop,
  },
  {
    id: 'texas-kolache',
    name: 'Texas Donut & Kolache',
    description: 'Tight donut lineup plus a full kolache menu (sausage, jalapeño, fruit, cream cheese) and breakfast tacos. Tuned for East Texas shops.',
    items: texasDonutKolache,
  },
]

export function getTemplate(id: string): MenuTemplate | null {
  return MENU_TEMPLATES.find(t => t.id === id) || null
}

// Back-compat: anything still importing `menuTemplate` gets the classic items.
export const menuTemplate: TemplateItem[] = classicDonutShop
