-- Automatiskt löpande ordernummer, samma mönster som offers (set_offer_number)
create or replace function set_order_number()
returns trigger language plpgsql as $$
declare
  next_num int;
begin
  select coalesce(max(cast(order_number as int)), 1000) + 1
  into next_num
  from orders
  where order_number ~ '^[0-9]+$';
  new.order_number := next_num::text;
  return new;
end;
$$;

create or replace trigger trg_order_number
before insert on orders
for each row when (new.order_number is null)
execute function set_order_number();
