import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { pool } from './db.js';

const ESTADOS = ['nuevo', 'contactado', 'interesado', 'convertido', 'perdido'];

const app = express();
app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());

// Listar leads
app.get('/leads', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id_lead, nombre, correo, telefono, interes, producto_servicio,
             prioridad, estado, veces_convertido, fecha_creacion, ultimo_contacto_at
      FROM tbl_lead
      ORDER BY fecha_creacion DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar los leads' });
  }
});

// Historial de un lead
app.get('/leads/:id/historial', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const { rows } = await pool.query(
      `SELECT estado_anterior, estado_nuevo, origen, cambiado_en
       FROM tbl_lead_historial
       WHERE id_lead = $1
       ORDER BY cambiado_en DESC`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar el historial' });
  }
});

// Transiciones permitidas (leídas de la base)
app.get('/transiciones', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT desde, array_agg(hacia ORDER BY hacia) AS destinos
      FROM transiciones_permitidas
      GROUP BY desde
    `);

    const transiciones = {};
    for (const fila of rows) {
      transiciones[fila.desde] = fila.destinos;
    }
    res.json(transiciones);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al consultar las transiciones' });
  }
});

// Cambiar estado (manual)
app.post('/leads/:id/estado', async (req, res) => {
  const id = Number(req.params.id);
  const { estado } = req.body;

  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: 'id inválido' });
  }
  if (!ESTADOS.includes(estado)) {
    return res.status(400).json({ error: `estado debe ser uno de: ${ESTADOS.join(', ')}` });
  }

  try {
    const { rows } = await pool.query(
      'SELECT * FROM cambiar_estado($1, $2, $3)',
      [id, estado, 'manual']
    );
    res.json(rows[0]);
  } catch (err) {
    if (err.code === 'P0001') {
      return res.status(409).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: 'Error al cambiar el estado' });
  }
});

// Crear lead (reenvía al webhook de n8n)
app.post('/leads', async (req, res) => {
  const nombre = String(req.body.nombre ?? '').trim();
  const correo = String(req.body.correo ?? '').trim().toLowerCase();
  const telefono = String(req.body.telefono ?? '').trim();
  const mensaje = String(req.body.mensaje ?? '').trim();

  if (!nombre || !correo || !mensaje) {
    return res.status(400).json({ error: 'nombre, correo y mensaje son obligatorios' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
    return res.status(400).json({ error: 'El correo no tiene un formato válido' });
  }
  if (mensaje.length > 2000) {
    return res.status(400).json({ error: 'El mensaje es demasiado largo (máximo 2000)' });
  }

  try {
    const respuesta = await fetch(process.env.N8N_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nombre, correo, telefono, mensaje }),
      signal: AbortSignal.timeout(45000),
    });

    if (!respuesta.ok) {
      console.error('n8n respondió', respuesta.status);
      return res.status(502).json({ error: 'No se pudo procesar el lead' });
    }
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'No se pudo contactar el flujo de n8n' });
  }
});

app.get('/borradores', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT b.id_borrador, b.id_lead, b.asunto, b.cuerpo, b.creado_en, l.nombre, l.correo
       FROM tbl_borrador b
       JOIN tbl_lead l ON l.id_lead = b.id_lead
       WHERE b.estado = 'pendiente'
       ORDER BY b.creado_en`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al leer borradores' });
  }
});

app.post('/borradores/:id/resolver', async (req, res) => {
  const { decision } = req.body;
  if (!['aprobado', 'descartado'].includes(decision)) {
    return res.status(400).json({ error: 'decision inválida' });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE tbl_borrador
       SET estado = $1, resuelto_en = now()
       WHERE id_borrador = $2 AND estado = 'pendiente'
       RETURNING *`,
      [decision, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Borrador no encontrado o ya resuelto' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al resolver el borrador' });
  }
});

app.post('/borradores/:id/enviar', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id inválido' });
  }
  try {
    const r = await fetch(process.env.N8N_ENVIAR_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.N8N_ENVIAR_SECRET,
      },
      body: JSON.stringify({ id_borrador: id }),
    });
    if (r.status === 404) {
      return res.status(404).json({ error: 'Borrador no encontrado o ya resuelto' });
    }
    if (!r.ok) {
      return res.status(502).json({ error: 'n8n no pudo enviar el correo' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: 'No se pudo contactar a n8n' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`API escuchando en http://localhost:${process.env.PORT}`);
});