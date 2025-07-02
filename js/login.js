async function hash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// Configuración inicial (solo la primera vez, luego puedes comentar)
(async () => {
  const usuario = "Los SS";
  const contrasena = await hash("9424");
  localStorage.setItem("credenciales", JSON.stringify({ usuario, contrasena }));

  // Guarda un PIN inicial
  localStorage.setItem("pin", "9424");
})();

// ------------------ LOGIN TRADICIONAL ------------------
async function iniciarSesion() {
  const user = document.getElementById("usuario").value.trim();
  const pass = document.getElementById("contrasena").value.trim();
  const hashPass = await hash(pass);

  const cred = JSON.parse(localStorage.getItem("credenciales"));

  if (cred && user === cred.usuario && hashPass === cred.contrasena) {
    sessionStorage.setItem("sesionIniciada", "true");
    // Activa biometría automáticamente si es compatible
    registrarBiometria();
    window.location.href = "index.html";
  } else {
    document.getElementById("error").textContent = "Usuario o contraseña incorrectos";
  }
}

// ------------------ LOGIN CON PIN ------------------
function loginConPIN() {
  const pinIngresado = document.getElementById("pinInput").value;
  const pinGuardado = localStorage.getItem("pin");
  if (pinIngresado === pinGuardado) {
    sessionStorage.setItem("sesionIniciada", "true");
    window.location.href = "index.html";
  } else {
    document.getElementById("error").textContent = "PIN incorrecto";
  }
}

// ------------------ LOGIN CON BIOMETRÍA ------------------
function loginConBiometria() {
  if (!window.PublicKeyCredential) {
    alert("Este navegador no soporta autenticación biométrica");
    return;
  }

  navigator.credentials.get({
    publicKey: {
      challenge: new Uint8Array(32),
      timeout: 60000,
      userVerification: "preferred"
    }
  }).then(assertion => {
    sessionStorage.setItem("sesionIniciada", "true");
    window.location.href = "index.html";
  }).catch(err => {
    console.error("Error en biometría:", err);
    alert("No se pudo autenticar con biometría");
  });
}

// ------------------ REGISTRAR BIOMETRÍA ------------------
function registrarBiometria() {
  if (!window.PublicKeyCredential) return;

  navigator.credentials.create({
    publicKey: {
      challenge: new Uint8Array(32),
      rp: {
        name: "Sistema Los SS"
      },
      user: {
        id: Uint8Array.from("losss", c => c.charCodeAt(0)),
        name: "usuario@losss.com",
        displayName: "Usuario Los SS"
      },
      pubKeyCredParams: [{ alg: -7, type: "public-key" }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "preferred"
      },
      timeout: 60000,
      attestation: "none"
    }
  }).then(cred => {
    console.log("Biometría registrada correctamente");
  }).catch(err => {
    console.warn("No se pudo registrar biometría:", err);
  });
}
