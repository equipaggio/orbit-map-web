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
    document.getElementById("home-screen").classList.remove("hidden");
    document.getElementById("map-screen").classList.add("hidden");
}

function mostraLicenza() {
    document.getElementById("license-screen").classList.remove("hidden");
    document.getElementById("map-screen").classList.add("hidden");
}

async function leggiTokenOneTimeSecret(secretKey) {
    const body = new FormData();
    body.append("secret_key", secretKey.trim());

    const risposta = await fetch(
        "https://orbit-map-web.onrender.com/reveal-token",
        {
            method: "POST",
            body: body
        }
    );

    if (!risposta.ok) {
        throw new Error("Token non trovato o già utilizzato");
    }

    const dati = await risposta.json();

    return dati.value || dati.secret || dati.secret_value || dati.secretValue || dati.record?.secret_value || "";
}

function verificaContenutoToken(contenutoToken, deviceId) {
    const tokenPermanente =
        "ORBITMAP|PERMANENTE|" + deviceId;

    if (contenutoToken.trim() === tokenPermanente) {
        return {
            valido: true,
            tipo: "PERMANENTE"
        };
    }

    if (contenutoToken.startsWith("ORBITMAP|SCADENZA|")) {
        const parti = contenutoToken.split("|");

        const dataScadenza = parti[2];
        const idToken = parti[3];

        if (idToken !== deviceId) {
            return {
                valido: false,
                motivo: "Token non valido per questo dispositivo."
            };
        }

        const oggi = new Date();
        oggi.setHours(0, 0, 0, 0);

        const scadenza = new Date(dataScadenza);
        scadenza.setHours(23, 59, 59, 999);

        if (oggi > scadenza) {
            return {
                valido: false,
                motivo: "Token scaduto."
            };
        }

        return {
            valido: true,
            tipo: "SCADENZA",
            scadenza: dataScadenza
        };
    }

    return {
        valido: false,
        motivo: "Formato token non valido."
    };
}

document.addEventListener("DOMContentLoaded", function () {
    mostraMappa();
});