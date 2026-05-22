let map = null;
let progettoTemporaneo = {
    aree:"",
    fp:"",
    siti:""
};

function mostraSchermata(id) {
    document.getElementById("license-screen").classList.add("hidden");
    document.getElementById("home-screen").classList.add("hidden");
    document.getElementById("project-screen").classList.add("hidden");
    document.getElementById("map-screen").classList.add("hidden");

    document.getElementById(id).classList.remove("hidden");
}

function caricaProgetti() {
    return JSON.parse(localStorage.getItem("orbit_map_web_projects") || "[]");
}

function salvaProgetti(lista) {
    localStorage.setItem("orbit_map_web_projects", JSON.stringify(lista));
}

function aggiornaListaProgetti() {
    const contenitore = document.getElementById("projects-list");
    const progetti = caricaProgetti();

    contenitore.innerHTML = "";

    if (progetti.length === 0) {
        contenitore.innerHTML = "<p>Nessun progetto salvato</p>";
        return;
    }

    progetti.forEach(function(progetto, index) {
        const div = document.createElement("div");
        div.className = "project-item";
        div.innerText = progetto.nome;

        div.onclick = function() {
            apriProgetto(index);
        };

        contenitore.appendChild(div);
    });
}

function leggiLinkDaTxt(testo) {
    let linkAree = "";
    let linkFp = "";
    let linkSiti = "";

    testo.split(/\r?\n/).forEach(function(riga) {
        const parti = riga.split("=");

        if (parti.length >= 2) {
            const chiave = parti[0].trim();
            const valore = parti.slice(1).join("=").trim();

            if (chiave === "KML_AREE") linkAree = valore;
            if (chiave === "KML_FP") linkFp = valore;
            if (chiave === "KML_SITI") linkSiti = valore;
        }
    });

    return {
        aree: linkAree,
        fp: linkFp,
        siti: linkSiti
    };
}

function convertiLinkDrive(link) {

    const regex =
        /\/file\/d\/([^/]+)\//;

    const match =
        link.match(regex);

    if (match) {

        const fileId =
            match[1];

        return (
            "https://drive.google.com/uc?export=download&id="
            + fileId
        );
    }

    return link;
}

function inizializzaMappa(progetto) {
    mostraSchermata("map-screen");

    document.getElementById("map-title").innerText = progetto.nome;

    setTimeout(function() {
        if (map !== null) {
            map.remove();
            map = null;
        }

        map = L.map("map").setView([41.3275, 19.8187], 8);

        L.tileLayer(
            "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
            {
                attribution:"Esri",
                maxZoom:20
            }
        ).addTo(map);

        L.tileLayer(
            "https://services.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
            {
                attribution:"Esri Boundaries & Places",
                maxZoom:20,
                opacity:1
            }
        ).addTo(map);

        map.invalidateSize();

    }, 300);
}

async function apriProgetto(index) {
    const progetti = caricaProgetti();
    const progetto = progetti[index];

    inizializzaMappa(progetto);

    setTimeout(async function() {
        await caricaAreeKml(progetto.aree);
    }, 800);
}

async function caricaAreeKml(linkAree) {
    try {
        const urlDrive =
            convertiLinkDrive(
                linkAree
            );

        const url =
            "https://orbit-map-web.onrender.com/proxy?url="
            +
            encodeURIComponent(
                urlDrive
            );

        const risposta =
            await fetch(
                url
            );

        if (
            !risposta.ok
        ) {

            throw new Error(
                "HTTP "
                +
                risposta.status
            );
        }

        const testoKml =
            await risposta.text();

        if (
            !testoKml.includes(
                "<kml"
            )
        ) {

            throw new Error(
                "KML non valido"
            );
        }

        console.log(
            "KML OK"
        );

        localStorage.setItem(
            "cache_aree_"
            +
            linkAree,
            testoKml
        );
        const aree = estraiElementiDaKml(testoKml);

        if (aree.length === 0) {
            alert("Nessuna area trovata nel KML.");
            return;
        }

        const bounds = [];

        aree.forEach(function(area) {
            const punti = area.punti.map(function(p) {
                return [p.lat, p.lon];
            });

            const polygon = L.polygon(
                punti,
                {
                    color: area.colore,
                    fillColor: area.colore,
                    fillOpacity:0.25,
                    weight:3
                }
            ).addTo(map);

            polygon.bindPopup(
                "<b>"
                +
                area.nome
                +
                "</b><br><br>"
                +
                area.descrizione.replaceAll(
                    "\n",
                    "<br>"
                )
            );

            polygon.bindTooltip(
                nomeBreveFP(area.nome),
                {
                    permanent:true,
                    direction:"center",
                    className:"fp-label"
                }
            );

            punti.forEach(
                function(p) {

                    bounds.push(
                        p
                    );

                }
            );
        });

        if (bounds.length > 0) {
            map.fitBounds(bounds, {
                padding: [30, 30]
            });
        }

    } catch (errore) {
        console.error(errore);
        alert("Errore caricamento KML_AREE: " + errore.message);
    }
}

function estraiElementiDaKml(kmlText) {
    const risultato = [];

    const parser = new DOMParser();
    const xml = parser.parseFromString(kmlText, "text/xml");

    const styles = {};
    const styleNodes = xml.getElementsByTagName("Style");

    for (let i = 0; i < styleNodes.length; i++) {
        const style = styleNodes[i];
        const id = style.getAttribute("id");

        const colorNode = style.getElementsByTagName("color")[0];

        if (id && colorNode) {
            styles[id] = coloreDaKml(colorNode.textContent.trim());
        }
    }

    const placemarks = xml.getElementsByTagName("Placemark");

    for (let i = 0; i < placemarks.length; i++) {
        const placemark = placemarks[i];

        const nome =
            placemark.getElementsByTagName("name")[0]?.textContent?.trim()
            || "Elemento KML";

        const descrizioneRaw =
            placemark.getElementsByTagName("description")[0]?.textContent
            || "";

        const descrizione = pulisciDescrizione(descrizioneRaw);

        let colore = "#ff0000";

        const styleUrl =
            placemark.getElementsByTagName("styleUrl")[0]?.textContent
            ?.replace("#", "")
            ?.trim();

        if (styleUrl && styles[styleUrl]) {
            colore = styles[styleUrl];
        }

        const coordNode =
            placemark.getElementsByTagName("coordinates")[0];

        if (!coordNode) {
            continue;
        }

        const coordText = coordNode.textContent.trim();

        const punti = coordText
            .split(/\s+/)
            .map(function(coppia) {
                const parti = coppia.split(",");

                return {
                    lon: parseFloat(parti[0]),
                    lat: parseFloat(parti[1])
                };
            })
            .filter(function(p) {
                return !isNaN(p.lat) && !isNaN(p.lon);
            });

        if (punti.length >= 3) {
            risultato.push({
                nome:nome,
                descrizione:descrizione,
                colore:colore,
                punti:punti
            });
        }
    }

    return risultato;
}

function coloreDaKml(kmlColor) {
    if (!kmlColor || kmlColor.length !== 8) {
        return "#ff0000";
    }

    const bb = kmlColor.substring(2, 4);
    const gg = kmlColor.substring(4, 6);
    const rr = kmlColor.substring(6, 8);

    return "#" + rr + gg + bb;
}

function pulisciDescrizione(testo) {
    return testo
        .replace("<![CDATA[", "")
        .replace("]]>", "")
        .replaceAll("<br>", "\n")
        .replaceAll("<br/>", "\n")
        .replaceAll("<br />", "\n")
        .replace(/<[^>]*>/g, " ")
        .replaceAll("&lt;", "<")
        .replaceAll("&gt;", ">")
        .replaceAll("&amp;", "&")
        .replaceAll("&quot;", "\"")
        .replaceAll("&#39;", "'")
        .trim();
}

window.addEventListener("load", function() {
    document.getElementById("filters-btn").onclick = function() {
    document.getElementById("filters-panel").classList.toggle("hidden");
};

    aggiornaListaProgetti();

    document.getElementById("new-project-btn").onclick = function() {
        progettoTemporaneo = {
            aree:"",
            fp:"",
            siti:""
        };

        document.getElementById("project-name-input").value = "";
        document.getElementById("txt-file-input").value = "";

        document.getElementById("preview-aree").innerText = "Non caricato";
        document.getElementById("preview-fp").innerText = "Non caricato";
        document.getElementById("preview-siti").innerText = "Non caricato";

        mostraSchermata("project-screen");
    };

    document.getElementById("back-home-btn").onclick = function() {
        mostraSchermata("home-screen");
    };

    document.getElementById("back-to-home-btn").onclick = function() {
        mostraSchermata("home-screen");
        aggiornaListaProgetti();
    };

    document.getElementById("txt-file-input").addEventListener("change", function(event) {
        const file = event.target.files[0];

        if (!file) {
            return;
        }

        const reader = new FileReader();

        reader.onload = function(e) {
            const testo = e.target.result;
            const links = leggiLinkDaTxt(testo);

            progettoTemporaneo = links;

            document.getElementById("preview-aree").innerText =
                links.aree ? "Caricato" : "Non trovato";

            document.getElementById("preview-fp").innerText =
                links.fp ? "Caricato" : "Non trovato";

            document.getElementById("preview-siti").innerText =
                links.siti ? "Caricato" : "Non trovato";
        };

        reader.readAsText(file);
    });

    document.getElementById("save-project-btn").onclick = function() {
        const nome = document.getElementById("project-name-input").value.trim();

        if (!nome) {
            alert("Inserisci il nome del progetto.");
            return;
        }

        if (!progettoTemporaneo.aree) {
            alert("TXT non valido: manca KML_AREE.");
            return;
        }

        const progetti = caricaProgetti();

        progetti.push({
            nome:nome,
            aree:progettoTemporaneo.aree,
            fp:progettoTemporaneo.fp,
            siti:progettoTemporaneo.siti
        });

        salvaProgetti(progetti);
        aggiornaListaProgetti();
        mostraSchermata("home-screen");
    };
});

function nomeBreveFP(nome) {
    const match = nome.match(/FP\s*0*([0-9]+)/i);

    if (match) {
        return "FP" + match[1].padStart(4, "0");
    }

    return nome;
}