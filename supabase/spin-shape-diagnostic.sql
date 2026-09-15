-- Diagnostic: the SHAPE of the last SPIn response, per register.
--
-- Card brand and last 4 have been empty on every card sale since the
-- integration went in, while the iPOSpays portal shows both for the same
-- transactions. The parser tries 8 tag names for last 4 and 7 for brand and
-- matches none, which means we're looking in the wrong PLACE, not for the
-- wrong names — most likely attributes rather than elements, or a field set
-- the gateway trims before sending.
--
-- This column carries the response with every digit masked to '#'. Tag names,
-- attribute names and nesting survive; PAN, auth codes and amounts do not. It
-- is deliberately not the raw response: storing that would put cardholder data
-- in a table that doesn't need it.
--
-- Drop the column once the parsing is fixed.

alter table public.dd_pos_devices
  add column if not exists last_spin_shape text;

comment on column public.dd_pos_devices.last_spin_shape is
  'Diagnostic only. Last SPIn response with all digits masked to #, for working out where card brand/last-4 live in the envelope. Never contains card data. Safe to drop once parsing is fixed.';
