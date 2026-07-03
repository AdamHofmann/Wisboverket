-- customers: fakturamail + betalvillkor saknades trots att kundformulären skriver dem
alter table customers
  add column if not exists fakturamail text,
  add column if not exists betalvillkor int not null default 30;
