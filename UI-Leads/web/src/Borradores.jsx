import { useEffect, useState } from 'react';
import { getBorradores, resolverBorrador, enviarBorrador } from './api';

export default function Borradores() {
  const [borradores, setBorradores] = useState([]);
  const [error, setError] = useState('');
  const [enviando, setEnviando] = useState(null);

  async function cargar() {
    try {
      setBorradores(await getBorradores());
      setError('');
    } catch (e) {
      setError(e.message);
    }
  }

  async function aprobarYEnviar(b) {
  if (!window.confirm(`¿Enviar este correo a ${b.correo}?`)) return;
  setEnviando(b.id_borrador);
  try {
    await enviarBorrador(b.id_borrador);
    await cargar();
  } catch (e) {
    setError(e.message);
  } finally {
    setEnviando(null);
  }
}

  useEffect(() => {
    cargar();
  }, []);

  async function decidir(id, decision) {
    try {
      await resolverBorrador(id, decision);
      await cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return (
    <section>
      <h2>Borradores pendientes ({borradores.length})</h2>
      {error && <p style={{ color: 'crimson' }}>{error}</p>}
      {borradores.length === 0 && <p>No hay borradores pendientes.</p>}
     {borradores.map((b) => (
        <article key={b.id_borrador} style={{ border: '1px solid #ccc', padding: 12, marginBottom: 12 }}>
            <strong>{b.nombre}</strong> ({b.correo})
            <p><b>Asunto:</b> {b.asunto}</p>
            <pre style={{ whiteSpace: 'pre-wrap' }}>{b.cuerpo}</pre>

            <button disabled={enviando === b.id_borrador} onClick={() => aprobarYEnviar(b)}>
            {enviando === b.id_borrador ? 'Enviando...' : 'Aprobar y enviar'}
            </button>
            <button onClick={() => decidir(b.id_borrador, 'descartado')}>Descartar</button>
        </article>
        ))}
    </section>
  );
}