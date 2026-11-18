-- Rollback de 202611200015_build_v2_audit_log.sql (el arreglo del typo de Tryndamere no se revierte).
drop table if exists public.build_v2_audit_log;
