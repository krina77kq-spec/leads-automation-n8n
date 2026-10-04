const API_URL = import.meta.env.VITE_API_URL;

async function request(path, options) {
  const res = await fetch(`${API_URL}${path}`, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Error inesperado');
  }
  return data;
}
export const getTransiciones = () => request('/transiciones');

export const getLeads = () => request('/leads');

export const getHistorial = (id) => request(`/leads/${id}/historial`);

export const cambiarEstado = (id, estado) =>
  request(`/leads/${id}/estado`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ estado }),
  });
  
export const crearLead = (datos) =>
  request('/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(datos),
  });

  export const getBorradores = () => request('/borradores');

export const resolverBorrador = (id, decision) =>
  request(`/borradores/${id}/resolver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ decision }),
  });

  export const enviarBorrador = (id) =>
  request(`/borradores/${id}/enviar`, { method: 'POST' });