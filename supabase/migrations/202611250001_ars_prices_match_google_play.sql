-- Precios en pesos de la web iguales a los que Google Play cobra en Argentina (conversión
-- automática de Play desde USD 2 / 5,50 / 20), así el plan cuesta lo mismo en la web y en la app.
-- Las suscripciones de Mercado Pago ya creadas mantienen su monto; esto aplica a las nuevas.
update public.membership_plans set amount_ars = 3200,  updated_at = now() where code = 'premium';
update public.membership_plans set amount_ars = 8750,  updated_at = now() where code = 'premium_quarterly';
update public.membership_plans set amount_ars = 31800, updated_at = now() where code = 'premium_annual';
