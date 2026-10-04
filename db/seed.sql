-- Adminer 6.1.1 PostgreSQL 16.15 dump

DROP TABLE IF EXISTS "public"."transiciones_permitidas";

DROP FUNCTION IF EXISTS "public"."cambiar_estado";;
CREATE FUNCTION "public"."cambiar_estado" (
  IN "p_lead_id" integer,
  IN "p_estado_nuevo" text,
  IN "p_origen" text
)
RETURNS tbl_lead LANGUAGE plpgsql AS $$
DECLARE
  v_lead tbl_lead;
  v_estado_anterior TEXT;
BEGIN
  -- 1. Buscar el lead y bloquear su fila
  SELECT * INTO v_lead FROM tbl_lead WHERE id_lead = p_lead_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead % no existe', p_lead_id;
  END IF;

  -- 2. Guardar el estado actual antes de cambiarlo
  v_estado_anterior := v_lead.estado;

  -- 3. Validar que la transición esté permitida
  IF NOT EXISTS (
    SELECT 1 FROM transiciones_permitidas
    WHERE desde = v_estado_anterior AND hacia = p_estado_nuevo
  ) THEN
    RAISE EXCEPTION 'Transición no permitida: % -> %', v_estado_anterior, p_estado_nuevo;
  END IF;

  -- 4. Actualizar el lead
  UPDATE tbl_lead SET
    estado = p_estado_nuevo,
    veces_convertido = veces_convertido + (CASE WHEN p_estado_nuevo = 'convertido' THEN 1 ELSE 0 END),
    ultimo_contacto_at = CASE WHEN p_estado_nuevo = 'contactado' THEN NOW() ELSE ultimo_contacto_at END,
    updated_at = NOW()
  WHERE id_lead = p_lead_id
  RETURNING * INTO v_lead;

  -- 5. Registrar en el historial
  INSERT INTO tbl_lead_historial (id_lead, estado_anterior, estado_nuevo, origen)
  VALUES (p_lead_id, v_estado_anterior, p_estado_nuevo, p_origen);

  -- 6. Devolver el lead ya actualizado
  RETURN v_lead;
END
$$;

INSERT INTO "public"."tbl_borrador" ("id_borrador", "id_lead", "asunto", "cuerpo", "estado", "creado_en", "resuelto_en", "enviado_en") VALUES
(3,	14,	'Seguimiento sobre tu automatización con IA',	'Hola Karina,

Espero que estés muy bien. Te escribo para dar seguimiento a tu interés en implementar automatización con IA para la atención de tu tienda.

Sé que mencionaste que es un tema urgente, por lo que me gustaría saber si tienes unos minutos esta semana para conversar sobre cómo podemos ayudarte a resolverlo.

Quedo a la espera de tus comentarios.

Saludos cordiales,
Tu equipo de automatizaciones',	'aprobado',	'2026-10-04 17:24:04.251082+00',	'2026-10-04 18:58:06.438214+00',	'2026-10-04 19:01:19.262864+00'),
(4,	14,	'Seguimiento sobre tu automatización con IA',	'Hola kARINA,

Espero que estés muy bien. Te escribo para dar seguimiento a tu interés en automatizar la atención de tu tienda con IA.

Comprendo que es un tema urgente y me encantaría saber si sigues buscando una solución para agilizar tus procesos. ¿Te vendría bien una breve llamada esta semana para revisar cómo podemos ayudarte?

Quedo a tu disposición.

Saludos cordiales,
El equipo de automatizaciones',	'aprobado',	'2026-10-04 19:02:28.818014+00',	'2026-10-04 19:03:15.178311+00',	NULL),
(5,	14,	'Seguimiento sobre automatización con IA para tu tienda',	'Hola kARINA,

Espero que te encuentres muy bien. Te escribo para dar seguimiento a tu interés en implementar automatización con IA para la atención de tu tienda.

Comprendo que es un tema urgente y me gustaría saber si tienes unos minutos esta semana para conversar sobre cómo podemos ayudarte.

Quedo a la espera de tus comentarios.

Saludos cordiales,
Tu equipo de automatizaciones',	'aprobado',	'2026-10-04 19:04:49.981478+00',	'2026-10-04 19:05:08.886817+00',	'2026-10-04 19:05:10.83938+00');

CREATE TABLE "public"."transiciones_permitidas" (
    "desde" text NOT NULL,
    "hacia" text NOT NULL,
    CONSTRAINT "transiciones_permitidas_pkey" PRIMARY KEY ("desde", "hacia")
);


-- 2026-10-04 20:59:09 UTC
