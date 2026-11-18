-- Corrige tipeos ("inflingen", "derrivar", "adapatable", "cuanto tienes") y los "\n"
-- escritos como texto en las descripciones de runas y objetos, en la tabla base y en los
-- datos del parche. Generado con scripts/catalog-text-fixes.mjs (1 cambios).

update public.runes set description = $rd$Al impactar a un campeón enemigo con un ataque o una habilidad, tú y el campeón aliado cercano con la menor cantidad de vida se curan. 

 Aliado: Recupera un 1.5% de Vida Máxima + un 5% de Poder de Habilidad. 

 Tú: Recuperas un 1% de tu Vida Máxima + un 5% de tu Poder de Habildiad. Enfriamiento: 20 seg. 

 Si eres un campeón cuerpo a cuerpo, la curación tiene un 130% de efectividad. (No se activa si tú o tus aliados cercanos tienen la vida al máximo; tampoco se activa si no hay aliados cerca).$rd$ where id::text = '6a04bc5f681bf773dac12a83';
