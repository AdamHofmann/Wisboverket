-- Elleverantörens namn på el-leverantörsfakturan (AI-skanningen läser redan av det).
alter table f_el_leverantorsfaktura add column if not exists leverantor text;
