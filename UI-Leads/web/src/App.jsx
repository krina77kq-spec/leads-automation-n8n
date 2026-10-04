import { useEffect, useState } from 'react';
import { getLeads, getHistorial, cambiarEstado, getTransiciones, crearLead } from './api';
import Borradores from './Borradores';
import './App.css';

function formatearFecha(valor) {
  if (!valor) return '—';
  return new Date(valor).toLocaleString('es-CR');
}

const FORM_VACIO = { nombre: '', correo: '', telefono: '', mensaje: '' };

export default function App() {
  const [leads, setLeads] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [leadSelId, setLeadSelId] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [cambiandoId, setCambiandoId] = useState(null);
  const [transiciones, setTransiciones] = useState({});
  const [filtroEstado, setFiltroEstado] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [form, setForm] = useState(FORM_VACIO);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(null);

  useEffect(() => {
    Promise.all([getLeads(), getTransiciones()])
      .then(([datosLeads, datosTransiciones]) => {
        setLeads(datosLeads);
        setTransiciones(datosTransiciones);
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
      }, []);

  async function verHistorial(lead) {
    setLeadSelId(lead.id_lead);
    try {
      setHistorial(await getHistorial(lead.id_lead));
    } catch (e) {
      setError(e.message);
    }
  }

  async function mover(lead, nuevoEstado) {
    setCambiandoId(lead.id_lead);
    setError(null);
    try {
      const actualizado = await cambiarEstado(lead.id_lead, nuevoEstado);
      setLeads((prev) =>
        prev.map((l) =>
          l.id_lead === actualizado.id_lead ? { ...l, ...actualizado } : l
        )
      );
      if (leadSelId === lead.id_lead) {
        setHistorial(await getHistorial(lead.id_lead));
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setCambiandoId(null);
    }
  }

  function cambiarCampo(e) {
  setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
}

async function enviarLead(e) {
  e.preventDefault();
  setEnviando(true);
  setError(null);
  setExito(null);
  try {
    await crearLead(form);
    setForm(FORM_VACIO);
    setLeads(await getLeads());
    setExito('Lead enviado y clasificado.');
  } catch (err) {
    setError(err.message);
  } finally {
    setEnviando(false);
  }
}


  const leadSel = leads.find((l) => l.id_lead === leadSelId);

  const textoBusqueda = busqueda.trim().toLowerCase();

    const leadsVisibles = leads.filter((l) => {
      const coincideEstado = filtroEstado === 'todos' || l.estado === filtroEstado;
      const coincideTexto =
        textoBusqueda === '' ||
        l.nombre?.toLowerCase().includes(textoBusqueda) ||
        l.correo?.toLowerCase().includes(textoBusqueda);
      return coincideEstado && coincideTexto;
    });

  if (cargando) return <p className="aviso">Cargando leads…</p>;

  return (
    <main>
      <Borradores />
      <h1>Seguimiento de leads</h1>

      {error && (
        <div className="error" role="alert">
          {error}
          <button onClick={() => setError(null)}>×</button>
        </div>
      )}

      <div className="filtros">

      <section className="formulario">
        <h2>Nuevo lead</h2>
        <form onSubmit={enviarLead}>
          <input name="nombre" placeholder="Nombre" value={form.nombre}
                onChange={cambiarCampo} required />
          <input name="correo" type="email" placeholder="Correo" value={form.correo}
                onChange={cambiarCampo} required />
          <input name="telefono" placeholder="Teléfono (opcional)" value={form.telefono}
                onChange={cambiarCampo} />
          <textarea name="mensaje" placeholder="Mensaje del cliente" rows="3"
                    value={form.mensaje} onChange={cambiarCampo} required />
          <button type="submit" disabled={enviando}>
            {enviando ? 'Enviando…' : 'Crear lead'}
          </button>
        </form>
        {exito && <p className="exito">{exito}</p>}
      </section>


  <input
    type="search"
    placeholder="Buscar por nombre o correo"
    value={busqueda}
    onChange={(e) => setBusqueda(e.target.value)}
  />

  <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
    <option value="todos">Todos los estados</option>
    {Object.keys(transiciones).map((estado) => (
      <option key={estado} value={estado}>{estado}</option>
    ))}
  </select>

  <span>{leadsVisibles.length} de {leads.length}</span>
</div>

      <table>
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Servicio</th>
            <th>Prioridad</th>
            <th>Estado</th>
            <th>Creado</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody>
          {leadsVisibles.map((lead) => (
            <tr key={lead.id_lead}>
              <td>{lead.nombre}</td>
              <td>{lead.correo}</td>
              <td>{lead.producto_servicio ?? '—'}</td>
              <td>{lead.prioridad ?? '—'}</td>
              <td>
                <span className={`estado estado-${lead.estado}`}>{lead.estado}</span>
              </td>
              <td>{formatearFecha(lead.fecha_creacion)}</td>
              <td className="acciones">
                {(transiciones[lead.estado] ?? []).map((destino) => (
                  <button
                    key={destino}
                    disabled={cambiandoId === lead.id_lead}
                    onClick={() => mover(lead, destino)}
                  >
                    → {destino}
                  </button>
                ))}
                <button className="secundario" onClick={() => verHistorial(lead)}>
                  Historial
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
          {leads.length === 0 && <p className="aviso">No hay leads todavía.</p>}
          {leads.length > 0 && leadsVisibles.length === 0 && (
            <p className="aviso">Ningún lead coincide con el filtro.</p>
          )}
      {leadSel && (
        <section className="historial">
          <h2>Historial de {leadSel.nombre}</h2>
          <ul>
            {historial.map((h, i) => (
              <li key={i}>
                {h.estado_anterior ?? '(inicio)'} → <strong>{h.estado_nuevo}</strong>
                {' · '}{h.origen}{' · '}{formatearFecha(h.cambiado_en)}
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}