-- Whether the customer screen asks for a phone number on its own.
--
-- Off by default, deliberately. Prompting puts a step in front of every sale
-- including the customers who do not want it, and a shop running a queue at
-- 7am may well decide that costs more than the enrolments are worth. The shop
-- that wants it turns it on.
--
-- Separate from rewards_enabled: a shop can run DonutDash Cash perfectly well
-- with the cashier asking, which is how it works today.
alter table public.dd_shops
  add column if not exists reward_prompt_customer boolean not null default false;
