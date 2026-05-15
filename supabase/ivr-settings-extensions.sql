-- Per-option forward numbers. Empty/null = use the global forward_number.

alter table dd_ivr_settings add column if not exists forward_number_0 text;
alter table dd_ivr_settings add column if not exists forward_number_2 text;
alter table dd_ivr_settings add column if not exists forward_number_3 text;
alter table dd_ivr_settings add column if not exists forward_number_4 text;
