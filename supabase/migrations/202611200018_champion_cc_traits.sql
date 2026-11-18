-- Control de masas en traits para 71 campeones que no tenían ninguno (87 de 143
-- figuraban sin control). Lo usan Build V2 (piezas que se activan con tu propio control,
-- como Mandato Imperial) y el Coach (amenaza de control rival). Sin texto de habilidades
-- en el catálogo: sale del conocimiento de los kits; ante la duda no se agrega nada.
-- Sin control a propósito: Kai'Sa, Maestro Yi, Katarina, Lucian, Ezreal, Sivir, Samira,
-- Corki, Akali. Sin cargar por dudas del kit de Wild Rift: Akshan, Ambessa, Aurora,
-- Kha'Zix, Nidalee, Smolder, Yunara.
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Aurelion Sol';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Bardo';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Brand';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Caitlyn';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Camille';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'silencio']::text[]) t where not t = any(traits)) where trim(name) = 'Cho''Gath';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Darius';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Diana';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Dr. Mundo';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Draven';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Ekko';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'encanto']::text[]) t where not t = any(traits)) where trim(name) = 'Evelynn';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Fiora';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Fizz';
update public.champions set traits = traits || array(select t from unnest(array['silencio']::text[]) t where not t = any(traits)) where trim(name) = 'Garen';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Gragas';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Graves';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Gwen';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Irelia';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Janna';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Jarvan IV';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Jax';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Jayce';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Jinx';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'K''sante';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Kalista';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Kassadin';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Kayle';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Kayn';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Kindred';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Kog''Maw';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Lee Sin';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root']::text[]) t where not t = any(traits)) where trim(name) = 'Mel';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Milio';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Miss Fortune';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Mordekaiser';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Nasus';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Nilah';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'miedo']::text[]) t where not t = any(traits)) where trim(name) = 'Nocturne';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Olaf';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Orianna';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Pyke';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Renekton';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Rengar';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Riven';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Rumble';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root']::text[]) t where not t = any(traits)) where trim(name) = 'Ryze';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root']::text[]) t where not t = any(traits)) where trim(name) = 'Senna';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'provocacion']::text[]) t where not t = any(traits)) where trim(name) = 'Shen';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Shyvana';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Singed';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Sion';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Sona';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Swain';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro']::text[]) t where not t = any(traits)) where trim(name) = 'Sylas';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Talon';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Teemo';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Tristana';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Tryndamere';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Twitch';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Urgot';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Vayne';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Veigar';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'stun']::text[]) t where not t = any(traits)) where trim(name) = 'Viego';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Vladimir';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'supresion', 'miedo']::text[]) t where not t = any(traits)) where trim(name) = 'Warwick';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Xin Zhao';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'root']::text[]) t where not t = any(traits)) where trim(name) = 'Yuumi';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Zed';
update public.champions set traits = traits || array(select t from unnest(array['ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Zeri';
update public.champions set traits = traits || array(select t from unnest(array['cc_duro', 'ralentizacion']::text[]) t where not t = any(traits)) where trim(name) = 'Ziggs';
