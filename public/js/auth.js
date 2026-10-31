// Envía al login cuando la API responde que no hay sesión o que expiró
const Auth = (() => {
  const fetchOriginal = window.fetch.bind(window);

  window.fetch = async (...args) => {
    const res = await fetchOriginal(...args);
    if (res.status === 401) location.replace('/login.html');
    return res;
  };

  // En Vercel los archivos de public/ pueden servirse sin pasar por Express
  window.fetch('/api/sesion').catch(() => {});

  async function salir() {
    await fetchOriginal('/api/logout', { method: 'POST' }).catch(() => {});
    location.replace('/login.html');
  }

  return { salir };
})();
