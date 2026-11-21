-- ClauTIC Quest · Configuració inicial (sense dades personals ni comptes)
-- Curs, barris, grups R1–R7 / V1–V8 / M1–M2, competències, accions ràpides, regles de punts,
-- botiga, insígnies i missions. Tot és editable des del panell d'administració.
set search_path = public, extensions;

-- ───────────── Configuració base ─────────────
insert into settings (key, value) values
  ('dedupe_seconds', '3'), ('undo_minutes', '15')
on conflict do nothing;

insert into academic_years (name, start_date, end_date, is_current) values
  ('2025-2026', '2025-09-01', '2026-06-30', false),
  ('2026-2027', '2026-09-01', '2027-06-30', true)
on conflict do nothing;

insert into districts (name, color, sort, capacity) values
  ('Barri Cian', '#22D3EE', 0, 24), ('Barri Violeta', '#8B5CF6', 1, 24),
  ('Barri Grana', '#E5213B', 2, 24), ('Barri Menta', '#34D399', 3, 24);

insert into groups (code, name, line, academic_year_id, weekday, schedule)
select g.code, g.name, g.line::edu_line, (select id from academic_years where is_current), g.wd, g.sch
from (values
  ('R1','Robòtica 1 · Primària','robotica',1,'Dl 17:00-18:30'), ('R2','Robòtica 2 · Primària','robotica',2,'Dt 17:00-18:30'),
  ('R3','Robòtica 3','robotica',3,'Dc 17:00-18:30'), ('R4','Robòtica 4','robotica',4,'Dj 17:00-18:30'),
  ('R5','Robòtica 5 · ESO','robotica',1,'Dl 18:30-20:00'), ('R6','Robòtica 6 · ESO','robotica',3,'Dc 18:30-20:00'),
  ('R7','Robòtica 7 · Competició','robotica',6,'Ds 10:00-12:00'),
  ('V1','Videojocs 1 · Scratch','videojocs',1,'Dl 17:00-18:30'), ('V2','Videojocs 2 · Scratch','videojocs',2,'Dt 17:00-18:30'),
  ('V3','Videojocs 3 · Construct','videojocs',3,'Dc 17:00-18:30'), ('V4','Videojocs 4 · Construct','videojocs',4,'Dj 17:00-18:30'),
  ('V5','Videojocs 5 · Godot','videojocs',2,'Dt 18:30-20:00'), ('V6','Videojocs 6 · Godot','videojocs',4,'Dj 18:30-20:00'),
  ('V7','Videojocs 7 · Unity','videojocs',5,'Dv 17:00-18:30'), ('V8','Videojocs 8 · Projectes','videojocs',6,'Ds 12:00-14:00'),
  ('M1','Minecraft Education 1','minecraft',5,'Dv 17:00-18:30'), ('M2','Minecraft Education 2','minecraft',5,'Dv 18:30-20:00')
) as g(code, name, line, wd, sch);


insert into competencies (key, name, icon, color, description, examples, family_explanation, xp, coins, sort) values
 ('autonomia','Autonomia','🧭','#22D3EE','Treballa i pren decisions sense dependre constantment de l''adult.',
   array['Busca la solució abans de preguntar','Organitza el seu material','Continua el projecte sense que li ho recordin'],
   'Reconeixem que el vostre fill o filla és capaç d''avançar pel seu compte, prendre decisions i buscar recursos. És la base per aprendre a aprendre.', 10, 5, 1),
 ('creativitat','Creativitat','💡','#FBBF24','Proposa idees originals i solucions diferents.',
   array['Inventa una mecànica nova al joc','Dissenya un robot amb una solució original','Combina idees de manera inesperada'],
   'Valorem les idees pròpies i les solucions diferents. La tecnologia no és només seguir instruccions: és inventar.', 10, 5, 2),
 ('cooperacio','Cooperació','🤝','#34D399','Treballa en equip i ajuda els companys.',
   array['Ajuda un company encallat','Reparteix tasques en equip','Escolta i respecta les idees dels altres'],
   'Ha ajudat altres companys o ha treballat bé en equip. A ClauTIC aprenem junts i compartim el que sabem.', 10, 5, 3),
 ('perseveranca','Perseverança','🧗','#F472B6','No es rendeix davant els errors i les dificultats.',
   array['Torna a provar després d''un error','Depura el codi fins que funciona','Acaba el repte encara que costi'],
   'Davant d''un error o d''un repte difícil no s''ha rendit. Equivocar-se forma part d''aprendre a programar.', 10, 5, 4),
 ('aprenentatge','Aprenentatge','📚','#60A5FA','Aplica coneixements nous i previs.',
   array['Aplica un concepte après en una altra sessió','Fa servir correctament un sensor nou','Explica el que ha après'],
   'Ha demostrat que ha après alguna cosa nova i que la sap aplicar. Reconeixem el progrés, no la perfecció.', 10, 5, 5),
 ('comunicacio','Comunicació','🎤','#A78BFA','Explica, documenta i presenta el seu treball.',
   array['Presenta el projecte al grup','Documenta el codi o el muntatge','Explica clarament un problema'],
   'Ha sabut explicar o presentar la seva feina. Comunicar el que fem és tan important com fer-ho.', 10, 5, 6),
 ('responsabilitat','Responsabilitat','🛡️','#2DD4BF','Cuida el material, l''espai i els compromisos.',
   array['Recull i guarda el material','Assumeix un rol a l''equip','Compleix el que s''ha compromès a fer'],
   'Ha tingut cura del material, de l''espai o ha assumit una responsabilitat dins del grup.', 10, 5, 7),
 ('esforc','Esforç','💪','#E5213B','Hi posa ganes i dedicació, independentment del resultat.',
   array['Treballa concentrat tota la sessió','Millora respecte a la sessió anterior','Hi dedica temps extra'],
   'Reconeixem la dedicació i les ganes, encara que el resultat encara no sigui perfecte. L''esforç és el que fa créixer.', 10, 5, 8),
 ('compromis','Compromís','🎯','#FB923C','Implicació amb el grup, els projectes i l''acadèmia.',
   array['Porta idees de casa','Participa en activitats voluntàries','Anima l''equip'],
   'Mostra implicació amb el grup i amb els projectes. Agraïm aquesta actitud positiva.', 10, 5, 9);

insert into quick_actions (label, icon, competency_id, xp, coins, sort)
select q.label, q.icon, (select id from competencies where key = q.comp), q.xp, q.coins, q.sort
from (values
  ('Bon esforç','💪','esforc',10,5,1), ('Ha ajudat un company','🤝','cooperacio',10,5,2),
  ('Ha resolt un problema','🧩','perseveranca',10,5,3), ('Bona idea','💡','creativitat',10,5,4),
  ('Ha perseverat','🧗','perseveranca',10,5,5), ('Ha aplicat coneixements previs','📚','aprenentatge',10,5,6),
  ('Ha documentat el projecte','📝','comunicacio',10,5,7), ('Ha assumit responsabilitats','🛡️','responsabilitat',10,5,8)
) as q(label, icon, comp, xp, coins, sort);

insert into point_rules (key, label, xp, coins, description, sort) values
  ('assistencia', 'Assistència', 5, 2, 'S''atorga automàticament en confirmar la sessió.', 1),
  ('torneig', 'Participació en torneig', 40, 20, 'Lliga Minecraft, Sumo, competicions…', 2),
  ('altres_activitats', 'Participació en altres activitats', 20, 10, 'Jornades, activitats comunitàries…', 3),
  ('presentacio', 'Presentació de projecte', 30, 15, 'Presentar una creació davant el grup o les famílies.', 4),
  ('final_curs', 'Finalització de curs', 100, 50, 'En acabar el curs acadèmic.', 5);

insert into shop_items (key, name, slot, description, price, min_level, exclusive, color, sort) values
  ('torre','Casa Torre','model','Dos pisos i terrassa al terrat.',120,3,false,'#E8F1FF',1),
  ('cupula','Casa Cúpula','model','Cúpula geodèsica de vidre intel·ligent.',200,6,false,'#E8F1FF',2),
  ('solar_basic','Plaques solars','teulada','Energia neta per a la teva casa.',30,1,false,'#1E3A8A',1),
  ('antena','Antena de comunicacions','teulada','Connecta amb tota la ciutat.',40,1,false,'#94A3B8',2),
  ('turbina','Mini turbina eòlica','teulada','Gira amb el vent del barri.',70,3,false,'#E8F1FF',3),
  ('parabolica','Antena parabòlica','teulada','Rep senyals de l''espai.',90,4,false,'#CBD5E1',4),
  ('solar_pro','Plaques solars Pro','teulada','Plaques bifacials amb seguiment solar.',140,7,false,'#312E81',5),
  ('arbre_tec','Arbre tecnològic','jardi','Fulles que brillen de nit.',35,1,false,'#34D399',1),
  ('bonsai_led','Bonsai LED','jardi','Petit però espectacular.',45,2,false,'#A3E635',2),
  ('flors_holo','Flors hologràfiques','jardi','Canvien de color cada segon.',60,3,false,'#F472B6',3),
  ('font_mini','Font d''aigua lluminosa','jardi','Aigua reciclada amb llums.',100,5,false,'#22D3EE',4),
  ('robot_gos','Robot gos','robot','Fidel i juganer.',60,2,false,'#E5213B',1),
  ('robot_huma','Robot ajudant','robot','T''espera a la porta.',110,4,false,'#E8F1FF',2),
  ('robot_aranya','Robot aranya','robot','Sis potes i molta personalitat.',150,6,false,'#8B5CF6',3),
  ('dron_basic','Dron explorador','dron','Vigila el barri des de l''aire.',50,2,false,'#22D3EE',1),
  ('dron_llum','Dron de llum','dron','Il·lumina la nit.',90,4,false,'#FBBF24',2),
  ('dron_carrega','Dron de càrrega','dron','Porta paquets d''un costat a l''altre.',130,6,false,'#FB923C',3),
  ('holo_logo','Holograma ClauTIC','holograma','El logo de l''acadèmia en 3D.',40,1,false,'#E5213B',1),
  ('holo_pixel','Holograma píxel','holograma','Un personatge de 8 bits que saluda.',70,3,false,'#A3E635',2),
  ('holo_planeta','Holograma planeta','holograma','Un planeta que gira sobre la casa.',100,5,false,'#60A5FA',3),
  ('holo_cub','Cub de Minecraft','holograma','Un bloc hologràfic que levita.',80,4,false,'#34D399',4),
  ('bateria','Bateria domèstica','energia','Guarda l''energia del dia.',40,1,false,'#34D399',1),
  ('generador','Generador cinètic','energia','Energia del moviment.',80,4,false,'#FBBF24',2),
  ('nucli_mini','Mini nucli d''energia','energia','Una rèplica del gran nucli de la plaça.',160,8,false,'#E5213B',3),
  ('led_cian','LED cian','llum','Franja de llum cian.',20,1,false,'#22D3EE',1),
  ('led_violeta','LED violeta','llum','Franja de llum violeta.',20,1,false,'#8B5CF6',2),
  ('led_vermell','LED vermell ClauTIC','llum','El color de la casa.',20,1,false,'#E5213B',3),
  ('led_arcadia','LED arc de Sant Martí','llum','Tots els colors alhora.',90,5,false,'#F472B6',4),
  ('porta_lliscant','Porta lliscant','porta','S''obre sola en apropar-t''hi.',30,1,false,'#94A3B8',1),
  ('porta_portal','Porta portal','porta','Una porta que sembla un portal.',120,6,false,'#8B5CF6',2),
  ('facana_panells','Façana de panells','facana','Panells modulars amb juntes de llum.',50,2,false,'#CBD5E1',1),
  ('facana_vidre','Façana de vidre','facana','Vidre intel·ligent que s''enfosqueix.',90,4,false,'#7DD3FC',2),
  ('facana_circuit','Façana circuit','facana','Dibuix de placa base.',130,6,false,'#34D399',3),
  -- Exclusius (es desbloquegen amb insígnies)
  ('holo_trofeu','Trofeu hologràfic','holograma','Exclusiu: has participat en un torneig.',0,1,true,'#FBBF24',10),
  ('robot_veterà','Robot veterà','robot','Exclusiu: cinc anys a ClauTIC.',0,1,true,'#FBBF24',10),
  ('antena_daurada','Antena daurada','teulada','Exclusiu: tres anys a ClauTIC.',0,1,true,'#FBBF24',10),
  ('led_or','LED daurat','llum','Exclusiu: nivell 10.',0,1,true,'#FBBF24',10);

insert into badges (key, name, icon, color, description, category, rule_type, rule_value, xp, coins, unlock_item_key, sort) values
  ('any_1','Primer any','🌱','#34D399','Benvingut/da a ClauTIC! Aquest és el teu primer curs.','antiguitat','anys',1,0,10,null,1),
  ('anys_3','Tres anys','🌿','#22D3EE','Tres cursos aprenent amb nosaltres.','antiguitat','anys',3,0,25,'antena_daurada',2),
  ('anys_5','Cinc anys','🌳','#8B5CF6','Cinc cursos! Ja ets part de la història de ClauTIC.','antiguitat','anys',5,0,40,'robot_veterà',3),
  ('anys_7','Set anys','🏛️','#FBBF24','Set cursos: llegenda de ClauTIC City.','antiguitat','anys',7,0,60,null,4),
  ('nivell_5','Nivell 5','⚡','#22D3EE','Has arribat al nivell 5.','fita','nivell',5,0,15,null,10),
  ('nivell_10','Nivell 10','🔋','#8B5CF6','Has arribat al nivell 10.','fita','nivell',10,0,30,'led_or',11),
  ('nivell_20','Nivell 20','🌟','#FBBF24','Has arribat al nivell 20.','fita','nivell',20,0,50,null,12),
  ('reco_25','25 reconeixements','🎖️','#F472B6','Has rebut 25 reconeixements del professorat.','fita','reconeixements',25,0,15,null,13),
  ('reco_100','100 reconeixements','🏵️','#E5213B','Cent vegades reconegut/da. Increïble!','fita','reconeixements',100,0,40,null,14),
  ('missions_5','Explorador/a de missions','🗺️','#60A5FA','Has completat 5 missions.','missio','missions',5,0,20,null,20),
  ('activitats_3','Sempre a punt','🎪','#FB923C','Has participat en 3 activitats extraordinàries.','activitat','activitats',3,0,20,null,21),
  ('torneig','Primer torneig','🏆','#FBBF24','Has participat en un torneig de ClauTIC.','activitat',null,null,0,0,'holo_trofeu',30),
  ('sumo','Lluitador/a de Sumo','🤖','#E5213B','Has competit al Torneig de Sumo de robots.','activitat',null,null,0,0,null,31),
  ('minecraft_lliga','Lliga Minecraft','⛏️','#34D399','Has participat a la Lliga Minecraft.','activitat',null,null,0,0,null,32),
  ('mentor','Mentor/a','🧑‍🏫','#2DD4BF','Ha ajudat molts companys de manera continuada.','especial',null,null,0,20,null,40),
  ('projecte_estrella','Projecte estrella','✨','#A78BFA','Un projecte que ha inspirat tot el grup.','especial',null,null,0,20,null,41);

insert into missions (title, description, kind, line, icon, xp, coins, goal, repeatable, sort, badge_id) values
  ('Ajuda un company','Ajuda algú que està encallat fins que ho resolgui.','individual',null,'🤝',15,10,1,true,1,null),
  ('Resol un error','Troba i corregeix un error (bug) del teu projecte.','individual',null,'🐞',15,10,1,true,2,null),
  ('Documenta un projecte','Explica com funciona el teu projecte amb text, fotos o vídeo.','individual',null,'📝',20,10,1,false,3,null),
  ('Presenta una creació','Presenta el teu projecte davant del grup.','individual',null,'🎤',25,15,1,false,4,(select id from badges where key='projecte_estrella')),
  ('Robot seguidor de línia','Programa un robot que segueixi una línia negra.','individual','robotica','🛤️',25,15,1,false,10,null),
  ('Sensor d''obstacles','Fes que el robot s''aturi davant d''un obstacle.','individual','robotica','📡',20,10,1,false,11,null),
  ('Repte de Sumo','Construeix un robot capaç de treure un altre del dohyo.','individual','robotica','🥋',30,20,1,false,12,null),
  ('El meu primer joc','Crea un joc amb inici, objectiu i final.','individual','videojocs','🎮',25,15,1,false,20,null),
  ('Puntuació i vides','Afegeix un marcador i un sistema de vides al teu joc.','individual','videojocs','❤️',20,10,1,false,21,null),
  ('Nivell secret','Amaga un nivell secret dins del teu joc.','individual','videojocs','🔐',25,15,1,false,22,null),
  ('Constructor de redstone','Fes un mecanisme automàtic amb redstone.','individual','minecraft','🔴',25,15,1,false,30,null),
  ('Agent programador','Programa l''Agent perquè construeixi una estructura.','individual','minecraft','🤖',25,15,1,false,31,null),
  ('Energia per a la plaça','Entre tots, completem 40 missions per encendre la Font Hologràfica de la plaça.','comunitaria',null,'⚡',10,5,40,true,50,null),
  ('Jardí comunitari','Entre tots, completem 80 missions per fer créixer l''Arbre de Cristall.','comunitaria',null,'🌳',10,5,80,true,51,null),
  ('Satèl·lit ClauTIC','La gran fita: 150 missions per llançar el satèl·lit de la ciutat.','comunitaria',null,'🛰️',10,5,150,true,52,null);
update missions set unlock_key = 'font_holografica', unlock_name = 'Font Hologràfica' where title = 'Energia per a la plaça';
update missions set unlock_key = 'arbre_cristall', unlock_name = 'Arbre de Cristall' where title = 'Jardí comunitari';
update missions set unlock_key = 'satellit', unlock_name = 'Satèl·lit ClauTIC' where title = 'Satèl·lit ClauTIC';


analyze;
