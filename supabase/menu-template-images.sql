-- Stores admin-uploaded images for menu template items.
-- When a shop owner loads a template, items inherit these image URLs.
-- Keyed by (template_id, item_name) so admins can manage them without
-- redeploying the static template definitions.

create table if not exists dd_menu_template_images (
  template_id text not null,
  item_name text not null,
  image_url text not null,
  updated_at timestamptz not null default now(),
  primary key (template_id, item_name)
);

create index if not exists idx_dd_menu_template_images_template on dd_menu_template_images(template_id);
