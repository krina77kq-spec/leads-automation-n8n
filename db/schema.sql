-- Adminer 6.1.1 PostgreSQL 16.15 dump

DROP TABLE IF EXISTS "public"."tbl_borrador", "public"."tbl_lead", "public"."tbl_lead_historial";

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

CREATE TABLE "public"."tbl_borrador" (
    "id_borrador" serial NOT NULL,
    "id_lead" integer NOT NULL,
    "asunto" text NOT NULL,
    "cuerpo" text NOT NULL,
    "estado" text DEFAULT 'pendiente' NOT NULL,
    "creado_en" timestamptz DEFAULT now() NOT NULL,
    "resuelto_en" timestamptz,
    "enviado_en" timestamptz,
    CONSTRAINT "tbl_borrador_pkey" PRIMARY KEY ("id_borrador"),
    CONSTRAINT "tbl_borrador_estado_check" CHECK (((estado = ANY (ARRAY['pendiente'::text, 'aprobado'::text, 'descartado'::text]))))
);

CREATE UNIQUE INDEX uq_borrador_pendiente ON "public"."tbl_borrador" USING btree (id_lead) WHERE (estado = 'pendiente'::text);


CREATE TABLE "public"."tbl_lead" (
    "id_lead" integer GENERATED ALWAYS AS IDENTITY NOT NULL,
    "nombre" character varying(150) NOT NULL,
    "correo" character varying(100) NOT NULL,
    "telefono" character varying(30),
    "mensaje_original" text NOT NULL,
    "interes" character varying(100),
    "producto_servicio" character varying(100),
    "prioridad" character varying(20),
    "estado" character varying(20) DEFAULT 'nuevo' NOT NULL,
    "fecha_creacion" timestamptz DEFAULT now() NOT NULL,
    "respuesta_automatica_enviada" boolean DEFAULT false NOT NULL,
    "veces_convertido" integer DEFAULT '0' NOT NULL,
    "updated_at" timestamptz DEFAULT now() NOT NULL,
    "ultimo_contacto_at" timestamptz,
    "aviso_enviado_at" timestamptz,
    CONSTRAINT "tbl_lead_pkey" PRIMARY KEY ("id_lead"),
    CONSTRAINT "tbl_lead_prioridad_check" CHECK ((((prioridad)::text = ANY ((ARRAY['baja'::character varying, 'media'::character varying, 'alta'::character varying])::text[])))),
    CONSTRAINT "tbl_lead_estado_check" CHECK ((((estado)::text = ANY ((ARRAY['nuevo'::character varying, 'contactado'::character varying, 'interesado'::character varying, 'convertido'::character varying, 'perdido'::character varying])::text[]))))
);

CREATE UNIQUE INDEX uq_correo_lead ON "public"."tbl_lead" USING btree (correo);


CREATE TABLE "public"."tbl_lead_historial" (
    "id" bigserial NOT NULL,
    "id_lead" integer NOT NULL,
    "estado_anterior" text,
    "estado_nuevo" text NOT NULL,
    "origen" text DEFAULT 'sistema' NOT NULL,
    "cambiado_en" timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT "tbl_lead_historial_pkey" PRIMARY KEY ("id")
);

CREATE INDEX idx_historial_lead ON "public"."tbl_lead_historial" USING btree (id_lead, cambiado_en);


ALTER TABLE ONLY "public"."tbl_borrador" ADD CONSTRAINT "tbl_borrador_id_lead_fkey" FOREIGN KEY (id_lead) REFERENCES "public"."tbl_lead"(id_lead) ON DELETE CASCADE;

ALTER TABLE ONLY "public"."tbl_lead_historial" ADD CONSTRAINT "tbl_lead_historial_id_lead_fkey" FOREIGN KEY (id_lead) REFERENCES "public"."tbl_lead"(id_lead) ON DELETE CASCADE;

-- 2026-10-04 20:58:47 UTC
