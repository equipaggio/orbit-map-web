function generaDeviceId() {
    const dati = [
        navigator.userAgent,
        navigator.language,
        screen.width,
        screen.height,
        screen.colorDepth,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.platform,
        navigator.hardwareConcurrency || "",
        navigator.maxTouchPoints || ""
    ].join("|");

    let hash = 0;

    for (let i = 0; i < dati.length; i++) {
        hash = ((hash << 5) - hash) + dati.charCodeAt(i);
        hash = hash & hash;
    }

    return "WEB-" + Math.abs(hash).toString(16).toUpperCase();
}

function mostraMappa() {
    document.getElementById("license-screen").classList.add("hidden");
    document.getElementById("home-screen").classList.remove("hidden");
    document.getElementById("map-screen").classList.add("hidden");
}

function mostraLicenza() {
    document.getElementById("license-screen").classList.remove("hidden");
    document.getElementById("map-screen").classList.add("hidden");
}

function verificaTokenDemo(tokenInserito, deviceId) {
    const tokenCorretto = "ORBITMAPWEB|PERMANENTE|" + deviceId;

    return tokenInserito.trim() === tokenCorretto;
}

document.addEventListener("DOMContentLoaded", function () {
    const deviceId = generaDeviceId();

    document.getElementById("device-id-box").innerText = deviceId;

    const tokenSalvato = localStorage.getItem("orbit_map_web_token");
    const deviceSalvato = localStorage.getItem("orbit_map_web_device_id");

    if (tokenSalvato && deviceSalvato === deviceId) {
        if (verificaTokenDemo(tokenSalvato, deviceId)) {
            mostraMappa();
            return;
        }
    }

    mostraLicenza();

    document.getElementById("activate-btn").addEventListener("click", function () {
        const tokenInserito = document.getElementById("token-input").value;
        const messaggio = document.getElementById("license-message");

        if (verificaTokenDemo(tokenInserito, deviceId)) {
            localStorage.setItem("orbit_map_web_token", tokenInserito.trim());
            localStorage.setItem("orbit_map_web_device_id", deviceId);

            messaggio.style.color = "#00ff88";
            messaggio.innerText = "Licenza attivata correttamente.";

            setTimeout(function () {
                mostraMappa();
            }, 700);
        } else {
            messaggio.style.color = "#ff5555";
            messaggio.innerText = "Token non valido per questo dispositivo.";
        }
    });

    
});