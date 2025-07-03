// ------------------ ENCRIPTAR CONTRASEÑA ------------------
async function hash(texto) {
  const encoder = new TextEncoder();
  const data = encoder.encode(texto);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

// ------------------ PRIMERA CONFIGURACIÓN ------------------
(async () => {
  const usuario = "Los SS";
  const contrasena = await hash("9424");
  localStorage.setItem("credenciales", JSON.stringify({ usuario, contrasena }));

  // PIN por defecto
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
    registrarBiometria(); // Puedes comentar esta línea después de registrar una vez
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
async function loginConBiometria() {
  if (!window.PublicKeyCredential) {
    alert("Este navegador no soporta autenticación biométrica");
    return;
  }

  const credencialesGuardadas = JSON.parse(localStorage.getItem("credencialesWebAuthn"));

  if (!credencialesGuardadas || !credencialesGuardadas.credId) {
    alert("Primero debes registrar tu biometría.");
    return;
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: Uint8Array.from("LosSSChallenge", c => c.charCodeAt(0)),
        allowCredentials: [{
          id: Uint8Array.from(atob(credencialesGuardadas.credId), c => c.charCodeAt(0)).buffer,
          type: "public-key",
        }],
        timeout: 60000,
        userVerification: "required"
      }
    });

    // ✅ Si llega aquí, autenticación fue exitosa
    sessionStorage.setItem("sesionIniciada", "true");
    mostrarToast("✅ Bienvenido, autenticación biométrica exitosa");
    setTimeout(() => {
    window.location.href = "index.html";
    }, 1200);

  } catch (err) {
    console.error("Error de autenticación biométrica:", err);
    alert("No se pudo autenticar con biometría.");
  }
}

// ------------------ REGISTRAR BIOMETRÍA ------------------
async function registrarBiometria() {
  if (!window.PublicKeyCredential) {
    console.warn("Este navegador no soporta WebAuthn");
    return;
  }

  try {
    const usuario = "LosSS";
    const cred = await navigator.credentials.create({
      publicKey: {
        challenge: Uint8Array.from("LosSSChallenge", c => c.charCodeAt(0)),
        rp: {
          name: "Sistema Los SS"
        },
        user: {
          id: Uint8Array.from(usuario, c => c.charCodeAt(0)),
          name: usuario,
          displayName: "Usuario Los SS"
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        timeout: 60000,
        authenticatorSelection: {
          authenticatorAttachment: "platform",
          userVerification: "required"
        },
        attestation: "none"
      }
    });

    const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
    localStorage.setItem("credencialesWebAuthn", JSON.stringify({ credId }));

    console.log("Biometría registrada correctamente");

  } catch (err) {
    console.warn("No se pudo registrar biometría:", err);
  }
}

//Función Mostrar Toast
function mostrarToast(mensaje) {
  let toast = document.createElement("div");
  toast.textContent = mensaje;
  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.left = "50%";
  toast.style.transform = "translateX(-50%)";
  toast.style.background = "#4CAF50";
  toast.style.color = "white";
  toast.style.padding = "12px 24px";
  toast.style.borderRadius = "8px";
  toast.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
  toast.style.fontSize = "1rem";
  toast.style.zIndex = 9999;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 3000);
}
