// js/login.js

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

  // Si quieres que el usuario se registre automáticamente con biometría
  // la primera vez que inicia sesión con usuario/contraseña, puedes descomentar esto.
  // Pero lo ideal es que el usuario lo haga cuando le dé al botón de biometría.
  // localStorage.removeItem("credencialesWebAuthn"); // Para pruebas, asegura que no hay registro previo
})();

// ------------------ LOGIN TRADICIONAL ------------------
async function iniciarSesion() {
  const user = document.getElementById("usuario").value.trim();
  const pass = document.getElementById("contrasena").value.trim();
  const hashPass = await hash(pass);

  const cred = JSON.parse(localStorage.getItem("credenciales"));

  if (cred && user === cred.usuario && hashPass === cred.contrasena) {
    sessionStorage.setItem("sesionIniciada", "true");
    // ¡IMPORTANTE! Eliminada la llamada a registrarBiometria() aquí.
    // Ahora el registro se gestiona desde el botón de biometría.
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

// ------------------ FUNCIÓN PARA REGISTRAR BIOMETRÍA ------------------
async function registrarBiometria() {
    if (!window.PublicKeyCredential) {
        console.warn("Este navegador no soporta WebAuthn");
        mostrarToast("Tu navegador no soporta autenticación biométrica.", "error");
        return false; // Indicamos que no se pudo registrar
    }

    try {
        const usuario = "LosSS"; // Puedes usar un ID de usuario único aquí si tienes uno
        const cred = await navigator.credentials.create({
            publicKey: {
                challenge: Uint8Array.from("LosSSChallenge", c => c.charCodeAt(0)), // Desafío único
                rp: {
                    name: "Sistema Los SS" // Nombre de tu aplicación
                },
                user: {
                    id: Uint8Array.from(usuario, c => c.charCodeAt(0)),
                    name: usuario,
                    displayName: "Usuario Los SS"
                },
                pubKeyCredParams: [{ alg: -7, type: "public-key" }], // Algoritmo recomendado
                timeout: 60000, // Tiempo límite en ms
                authenticatorSelection: {
                    authenticatorAttachment: "platform", // Usar autenticadores integrados (ej. lector de huellas)
                    userVerification: "required" // Requiere PIN/huella/rostro
                },
                attestation: "none" // Nivel de atestación
            }
        });

        const credId = btoa(String.fromCharCode(...new Uint8Array(cred.rawId)));
        localStorage.setItem("credencialesWebAuthn", JSON.stringify({ credId }));

        mostrarToast("✅ Biometría registrada correctamente", "success");
        return true; // Indicamos que se registró exitosamente

    } catch (err) {
        console.warn("No se pudo registrar biometría:", err);
        mostrarToast("❌ Error al registrar la biometría. Intenta de nuevo.", "error");
        return false; // Indicamos que hubo un error al registrar
    }
}

// ------------------ FUNCIÓN PARA AUTENTICAR CON BIOMETRÍA ------------------
async function autenticarBiometria() {
    if (!window.PublicKeyCredential) {
        mostrarToast("Este navegador no soporta autenticación biométrica.", "error");
        return false;
    }

    const credencialesGuardadas = JSON.parse(localStorage.getItem("credencialesWebAuthn"));

    if (!credencialesGuardadas || !credencialesGuardadas.credId) {
        // No hay credenciales registradas, el flujo principal debería manejar esto
        return false;
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
        mostrarToast("✅ Bienvenido, autenticación biométrica exitosa", "success");
        setTimeout(() => {
            window.location.href = "index.html";
        }, 1200);
        return true;

    } catch (err) {
        console.error("Error de autenticación biométrica:", err);
        // Podríamos diferenciar errores para dar mensajes más específicos
        if (err.name === "NotAllowedError") {
            mostrarToast("Autenticación biométrica cancelada.", "info");
        } else if (err.name === "SecurityError") {
             mostrarToast("Error de seguridad en la autenticación biométrica.", "error");
        } else {
            mostrarToast("❌ No se pudo autenticar con biometría. Intenta registrarla si es la primera vez.", "error");
        }
        return false;
    }
}

// ------------------ NUEVA FUNCIÓN PRINCIPAL PARA EL BOTÓN DE BIOMETRÍA ------------------
async function intentarLoginORegistroBiometrico() {
    // 1. Intentar autenticar (login)
    const autenticacionExitosa = await autenticarBiometria();

    if (!autenticacionExitosa) {
        // 2. Si la autenticación no fue exitosa (posiblemente porque no hay registro)
        // Preguntar al usuario si desea registrar su biometría
        const credencialesGuardadas = JSON.parse(localStorage.getItem("credencialesWebAuthn"));

        if (!credencialesGuardadas || !credencialesGuardadas.credId) {
            // Solo ofrecer registro si no hay credenciales guardadas previamente
            const confirmarRegistro = confirm("No se encontró biometría registrada. ¿Deseas registrarla ahora para futuros inicios de sesión?");
            if (confirmarRegistro) {
                await registrarBiometria(); // Intentar registrar
                // Después de registrar, podríamos intentar autenticar de nuevo si es deseado
                // o simplemente esperar a que el usuario haga clic de nuevo.
                // Por simplicidad, por ahora, solo se registra.
            } else {
                 mostrarToast("Registro de biometría cancelado.", "info");
            }
        }
    }
    // Si la autenticación fue exitosa, autenticarBiometria ya redirigió
}

//Función Mostrar Toast
function mostrarToast(mensaje, tipo = "info") {
    let toast = document.createElement("div");
    toast.textContent = mensaje;
    toast.style.position = "fixed";
    toast.style.bottom = "20px";
    toast.style.left = "50%";
    toast.style.transform = "translateX(-50%)";
    toast.style.padding = "12px 24px";
    toast.style.borderRadius = "8px";
    toast.style.boxShadow = "0 4px 10px rgba(0,0,0,0.2)";
    toast.style.fontSize = "1rem";
    toast.style.zIndex = 9999;

    if (tipo === "success") {
        toast.style.background = "#4CAF50"; // Verde
        toast.style.color = "white";
    } else if (tipo === "error") {
        toast.style.background = "#f44336"; // Rojo
        toast.style.color = "white";
    } else { // info
        toast.style.background = "#2196F3"; // Azul
        toast.style.color = "white";
    }

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}
