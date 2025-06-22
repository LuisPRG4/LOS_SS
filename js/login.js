async function hash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Establecer usuario por primera vez (puedes comentar esta parte luego de usarla una vez)
(async () => {
  const usuario = "Los SS";
  const contrasena = await hash("luis");
  localStorage.setItem("credenciales", JSON.stringify({ usuario, contrasena }));
})();

async function iniciarSesion() {
  const user = document.getElementById("usuario").value.trim();
  const pass = document.getElementById("contrasena").value.trim();
  const hashPass = await hash(pass);

  const cred = JSON.parse(localStorage.getItem("credenciales"));

  if (cred && user === cred.usuario && hashPass === cred.contrasena) {
    sessionStorage.setItem("sesionIniciada", "true");
    window.location.href = "index.html";
  } else {
    document.getElementById("error").textContent = "Usuario o contraseña incorrectos";
  }
}