let map = null;
let municipalitaLayer = [];
let prefettureLayer = [];
let lineeFpQuote = [];

let areeCaricate = [];
let filtroMunicipalitaAttivo = null;
let filtroPrefetturaAttivo = null;
let sitiCaricati = [];
let filtroSitiAttivo = null;
let markerRicerca = null;
let boundsAree = null;
let sitiLayer = [];

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

    areeCaricate = [];
    filtroMunicipalitaAttivo = null;
    filtroPrefetturaAttivo = null;

    setTimeout(async function() {
        try {
            mostraCaricamento("Caricamento municipalità...", 15);
            await caricaMunicipalita();

            mostraCaricamento("Caricamento prefetture...", 35);
            await caricaPrefetture();

            mostraCaricamento("Caricamento quote FP...", 55);
            await caricaKmlFp(progetto.fp);

            mostraCaricamento("Caricamento aree KML...", 75);
            await caricaAreeKml(progetto.aree);

            mostraCaricamento("Caricamento siti...", 90);
            await caricaKmlSiti(progetto.siti);

            aggiornaFiltroMunicipalita();
            aggiornaFiltroPrefettura();
            aggiornaFiltroSiti();

            mostraCaricamento("Preparazione mappa completata", 100);

            setTimeout(function() {
                nascondiCaricamento();
            }, 600);

        } catch (errore) {
            nascondiCaricamento();
            alert("Errore caricamento progetto: " + errore.message);
        }
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

            const municipalita = trovaPrevalente(area.punti, municipalitaLayer);
            const prefettura = trovaPrevalente(area.punti, prefettureLayer);

            area.municipalita = municipalita;
            area.prefettura = prefettura;

            areeCaricate.push({
                polygon: polygon,
                nome: area.nome,
                municipalita: municipalita,
                prefettura: prefettura,
                coloreOriginale: area.colore
            });

            const quoteArea = calcolaQuoteArea(area.nome);

            const quotaMin = quoteArea.min !== null ? quoteArea.min : "Non trovata";
            const quotaMax = quoteArea.max !== null ? quoteArea.max : "Non trovata";

            let descrizioneNuova = area.descrizione;

            const bloccoInfo =
                "\n\nMunicipalità: " + municipalita +
                "\nPrefettura: " + prefettura +
                "\nQuota min (in ft): " + quotaMin +
                "\nQuota max (in ft): " + quotaMax + "\n\n";

            descrizioneNuova = descrizioneNuova.replace(
                /Coordinate area:/i,
                bloccoInfo + "Coordinate area:"
            );

            polygon.bindPopup(
                "<b>" + area.nome + "</b><br><br>" +
                descrizioneNuova.replaceAll("\n", "<br>")
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

            boundsAree = bounds;

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

    document.getElementById("search-btn").onclick = function() {
        document.getElementById("search-panel").classList.toggle("hidden");
    };

    document.getElementById("municipality-filter").onchange = function() {
        applicaFiltroMunicipalita(this.value);
    };
    document.getElementById("prefecture-filter").onchange = function() {
        applicaFiltroPrefettura(this.value);
    };

    document.getElementById("show-sites-check").onchange = function() {
        aggiornaVisibilitaSiti();
    };

    document.getElementById("sites-filter").onchange = function() {
        aggiornaVisibilitaSiti();
    };

    document.getElementById("clear-filters-btn").onclick = function() {
        disattivaFiltri();
    };

    document.getElementById("city-search-action-btn").onclick = function() {
        cercaCitta();
    };

    document.getElementById("clear-search-btn").onclick = function() {
        disattivaRicerca();
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

async function caricaMunicipalita() {

    const url =
        "https://orbit-map-web.onrender.com/proxy?url="
        +
        encodeURIComponent(
            "https://equipaggio.github.io/orbit-map-web/municipalita_albania.kml"
        );

    const testo =
        await (
            await fetch(
                url
            )
        ).text();

    municipalitaLayer = parseKmlPoligoni(testo, "municipalita");
}

async function caricaPrefetture() {

    const url =
        "https://orbit-map-web.onrender.com/proxy?url="
        +
        encodeURIComponent(
            "https://equipaggio.github.io/orbit-map-web/prefetture_albania.kml"
        );

    const testo =
        await (
            await fetch(
                url
            )
        ).text();

    prefettureLayer = parseKmlPoligoni(testo, "prefettura");
}

function parseKmlPoligoni(kml, tipo) {
    const xml = new DOMParser().parseFromString(kml, "text/xml");
    const placemarks = xml.getElementsByTagName("Placemark");

    let lista = [];

    for (let p of placemarks) {
        let nome = "N/D";

        if (tipo === "municipalita") {
            nome =
                p.querySelector('SimpleData[name="shapeName"]')?.textContent?.trim()
                || p.getElementsByTagName("name")[0]?.textContent?.trim()
                || "Municipalità";
        }

        if (tipo === "prefettura") {
            nome =
                p.querySelector('SimpleData[name="ADM1_EN"]')?.textContent?.trim()
                || p.getElementsByTagName("name")[0]?.textContent?.trim()
                || "Prefettura";
        }

        const coordNodes = p.getElementsByTagName("coordinates");

        for (let c of coordNodes) {
            const punti = c.textContent.trim()
                .split(/\s+/)
                .map(function(coppia) {
                    const parti = coppia.split(",");
                    return {
                        lon: parseFloat(parti[0]),
                        lat: parseFloat(parti[1])
                    };
                })
                .filter(function(pt) {
                    return !isNaN(pt.lat) && !isNaN(pt.lon);
                });

            if (punti.length >= 3) {
                lista.push({
                    nome:nome,
                    punti:punti
                });
            }
        }
    }

    return lista;
}

function puntoDentroPoligono(punto, poligono) {
    let dentro = false;
    let j = poligono.length - 1;

    for (let i = 0; i < poligono.length; i++) {
        const pi = poligono[i];
        const pj = poligono[j];

        const interseca =
            ((pi.lat > punto.lat) !== (pj.lat > punto.lat)) &&
            (punto.lon <
                (pj.lon - pi.lon) *
                (punto.lat - pi.lat) /
                (pj.lat - pi.lat) +
                pi.lon);

        if (interseca) {
            dentro = !dentro;
        }

        j = i;
    }

    return dentro;
}

function trovaPrevalente(puntiArea, listaPoligoni) {
    if (!puntiArea || puntiArea.length < 3) {
        return "Non trovata";
    }

    const minLat = Math.min(...puntiArea.map(p => p.lat));
    const maxLat = Math.max(...puntiArea.map(p => p.lat));
    const minLon = Math.min(...puntiArea.map(p => p.lon));
    const maxLon = Math.max(...puntiArea.map(p => p.lon));

    const righe = 20;
    const colonne = 20;

    const passoLat = (maxLat - minLat) / righe;
    const passoLon = (maxLon - minLon) / colonne;

    const conteggio = {};

    if (passoLat === 0 || passoLon === 0) {
        return "Non trovata";
    }

    for (let r = 0; r < righe; r++) {
        for (let c = 0; c < colonne; c++) {
            const punto = {
                lat:minLat + passoLat * (r + 0.5),
                lon:minLon + passoLon * (c + 0.5)
            };

            if (!puntoDentroPoligono(punto, puntiArea)) {
                continue;
            }

            listaPoligoni.forEach(function(poly) {
                if (puntoDentroPoligono(punto, poly.punti)) {
                    conteggio[poly.nome] = (conteggio[poly.nome] || 0) + 1;
                }
            });
        }
    }

    let migliore = "Non trovata";
    let max = 0;

    Object.keys(conteggio).forEach(function(nome) {
        if (conteggio[nome] > max) {
            max = conteggio[nome];
            migliore = nome;
        }
    });

    return migliore;
}
async function caricaKmlFp(linkFp) {
    if (!linkFp) {
        lineeFpQuote = [];
        return;
    }

    const urlDrive = convertiLinkDrive(linkFp);

    const url =
        "https://orbit-map-web.onrender.com/proxy?url=" +
        encodeURIComponent(urlDrive);

    const risposta = await fetch(url);

    if (!risposta.ok) {
        throw new Error("Errore KML_FP HTTP " + risposta.status);
    }

    const testoKml = await risposta.text();

    lineeFpQuote = estraiLineeFpConQuota(testoKml);
}

function estraiLineeFpConQuota(kmlText) {
    const risultato = [];

    const xml = new DOMParser().parseFromString(kmlText, "text/xml");
    const placemarks = xml.getElementsByTagName("Placemark");

    for (let p of placemarks) {
        const nome =
            p.getElementsByTagName("name")[0]?.textContent?.trim()
            || "Linea FP";

        const quotaText =
            p.getElementsByTagName("AMSL_FT_Start")[0]?.textContent?.trim()
            || "";

        const quotaFt = parseInt(quotaText, 10);

        if (isNaN(quotaFt)) {
            continue;
        }

        const coordNode = p.getElementsByTagName("coordinates")[0];

        if (!coordNode) {
            continue;
        }

        const punti = coordNode.textContent.trim()
            .split(/\s+/)
            .map(function(coppia) {
                const parti = coppia.split(",");
                return {
                    lon: parseFloat(parti[0]),
                    lat: parseFloat(parti[1])
                };
            })
            .filter(function(pt) {
                return !isNaN(pt.lat) && !isNaN(pt.lon);
            });

        if (punti.length >= 2) {
            risultato.push({
                nome:nome,
                quotaFt:quotaFt,
                punti:punti
            });
        }
    }

    return risultato;
}

function calcolaQuoteArea(nomeArea) {
    const fpArea = nomeBreveFP(nomeArea);

    const quote = lineeFpQuote
        .filter(function(linea) {
            return linea.nome.toUpperCase().includes(fpArea.toUpperCase());
        })
        .map(function(linea) {
            return linea.quotaFt;
        });

    if (quote.length === 0) {
        return {
            min:null,
            max:null
        };
    }

    return {
        min:Math.min(...quote),
        max:Math.max(...quote)
    };
}

function mostraCaricamento(testo, percentuale) {
    document.getElementById("loading-box").classList.remove("hidden");
    document.getElementById("loading-text").innerText = testo;
    document.getElementById("loading-progress").style.width = percentuale + "%";
}

function nascondiCaricamento() {
    document.getElementById("loading-box").classList.add("hidden");
}

function aggiornaFiltroMunicipalita() {

    const menu =
        document.getElementById(
            "municipality-filter"
        );

    if (!menu) {
        return;
    }

    menu.innerHTML =
        "<option value=''>Tutte</option>";

    const uniche =
        [...new Set(
            areeCaricate.map(
                a => a.municipalita
            )
        )]
        .filter(Boolean)
        .sort();

    console.log("AREE CARICATE:", areeCaricate);
    console.log("MUNICIPALITA TROVATE:", uniche);

    uniche.forEach(function(nome) {

        const opt =
            document.createElement(
                "option"
            );

        opt.value = nome;
        opt.textContent = nome;

        menu.appendChild(opt);

    });
}

function applicaFiltroMunicipalita(nome) {

    filtroMunicipalitaAttivo = nome;

    aggiornaEvidenziazioniAree();

}
function aggiornaFiltroPrefettura() {

    const menu = document.getElementById("prefecture-filter");

    if (!menu) {
        return;
    }

    menu.innerHTML = "<option value=''>Tutte</option>";

    const uniche =
        [...new Set(
            areeCaricate.map(a => a.prefettura)
        )]
        .filter(Boolean)
        .sort();

    uniche.forEach(function(nome) {

        const opt = document.createElement("option");

        opt.value = nome;
        opt.textContent = nome;

        menu.appendChild(opt);

    });
}

function applicaFiltroPrefettura(nome) {

    filtroPrefetturaAttivo = nome;

    aggiornaEvidenziazioniAree();

}

function disattivaFiltri() {

    filtroMunicipalitaAttivo = null;
    filtroPrefetturaAttivo = null;

    document.getElementById("municipality-filter").value = "";
    document.getElementById("prefecture-filter").value = "";
    document.getElementById("sites-filter").value = "";
    filtroSitiAttivo = null;
    document.getElementById("show-sites-check").checked = false;

    aggiornaVisibilitaSiti();

    filtroMunicipalitaAttivo = null;
    filtroPrefetturaAttivo = null;

    aggiornaEvidenziazioniAree();

    document.getElementById("filters-panel").classList.add("hidden");
}

async function caricaKmlSiti(linkSiti) {

    sitiCaricati = [];

    if (!linkSiti) {
        return;
    }

    const urlDrive =
        convertiLinkDrive(
            linkSiti
        );

    const url =
        "https://orbit-map-web.onrender.com/proxy?url="
        +
        encodeURIComponent(
            urlDrive
        );

    const risposta =
        await fetch(url);

    if (!risposta.ok) {
        return;
    }

    const testo =
        await risposta.text();

    const xml =
        new DOMParser()
        .parseFromString(
            testo,
            "text/xml"
        );

    const placemarks =
        xml.getElementsByTagName(
            "Placemark"
        );

    for (let p of placemarks) {

        const anno =
            p.querySelector(
                'SimpleData[name="anno"]'
            )?.textContent?.trim()
            ||
            p.querySelector(
                'SimpleData[name="ANNO"]'
            )?.textContent?.trim()
            ||
            "";

        const nome =
            p.getElementsByTagName("name")[0]?.textContent?.trim()
            || "Sito";

        const coordNode =
            p.getElementsByTagName("coordinates")[0];

        if (!coordNode || !anno) {
            continue;
        }

        const parti =
            coordNode.textContent.trim().split(",");

        const lon = parseFloat(parti[0]);
        const lat = parseFloat(parti[1]);

        if (isNaN(lat) || isNaN(lon)) {
            continue;
        }

        const marker = L.circleMarker(
            [lat, lon],
            {
                radius:6,
                fillOpacity:0.9,
                opacity:1,
                weight:2
            }
        );

        marker.bindPopup(
            "<b>" + nome + "</b><br>Anno: " + anno
        );

        sitiLayer.push(marker);

        sitiCaricati.push({
            anno:anno,
            marker:marker,
            nome:nome
        });

    }

    console.log(
        "SITI:",
        sitiCaricati
    );
}

function aggiornaFiltroSiti() {

    const menu =
        document.getElementById(
            "sites-filter"
        );

    if (!menu) {
        return;
    }

    menu.innerHTML =
        "<option value=''>Tutti</option>";

    const anni =
        [...new Set(
            sitiCaricati.map(
                s => s.anno
            )
        )]
        .filter(Boolean)
        .sort();

    anni.forEach(function(a) {

        const opt =
            document.createElement(
                "option"
            );

        opt.value = a;
        opt.textContent = a;

        menu.appendChild(opt);

    });

    console.log(
        "ANNI TROVATI:",
        anni
    );
}
function aggiornaVisibilitaSiti() {

    const mostraSiti =
        document.getElementById("show-sites-check").checked;

    const anno =
        document.getElementById("sites-filter").value;

    sitiCaricati.forEach(function(sito) {

        if (!sito.marker) {
            return;
        }

        const deveEssereVisibile =
            mostraSiti &&
            (
                !anno ||
                sito.anno === anno
            );

        if (deveEssereVisibile) {

            if (!map.hasLayer(sito.marker)) {
                sito.marker.addTo(map);
            }

        } else {

            if (map.hasLayer(sito.marker)) {
                map.removeLayer(sito.marker);
            }

        }

    });
}

function aggiornaEvidenziazioniAree() {

    areeCaricate.forEach(function(area) {

        let colore = area.coloreOriginale;
        let fillOpacity = 0.25;
        let weight = 3;

        if (
            filtroMunicipalitaAttivo &&
            area.municipalita === filtroMunicipalitaAttivo
        ) {
            colore = "#ffff00";
            fillOpacity = 0.45;
            weight = 5;
        }

        if (
            filtroPrefetturaAttivo &&
            area.prefettura === filtroPrefetturaAttivo
        ) {
            colore = "#ff9800";
            fillOpacity = 0.45;
            weight = 5;
        }

        area.polygon.setStyle({
            color: colore,
            fillColor: colore,
            fillOpacity: fillOpacity,
            opacity: 1,
            weight: weight
        });

    });
}

async function cercaCitta() {

    const testo =
        document.getElementById(
            "city-search-input"
        ).value.trim();

    if (!testo) {
        return;
    }

    const url =
        "https://nominatim.openstreetmap.org/search?format=json&q="
        +
        encodeURIComponent(
            testo
        );

    const risposta =
        await fetch(
            url
        );

    const dati =
        await risposta.json();

    if (
        !dati.length
    ) {
        alert(
            "Città non trovata"
        );
        return;
    }

    const lat =
        parseFloat(
            dati[0].lat
        );

    const lon =
        parseFloat(
            dati[0].lon
        );

    if (
        markerRicerca
    ) {

        map.removeLayer(
            markerRicerca
        );

    }

    markerRicerca =
        L.marker(
            [lat, lon]
        )
        .addTo(map);

    markerRicerca
        .bindPopup(
            testo
        )
        .openPopup();

    map.setView(
        [lat, lon],
        12
    );
}

function disattivaRicerca() {

    if (
        markerRicerca
    ) {

        map.removeLayer(
            markerRicerca
        );

        markerRicerca =
            null;

    }

    document.getElementById(
        "search-panel"
    ).classList.add(
        "hidden"
    );

    document.getElementById(
        "city-search-input"
    ).value = "";

    if (
        boundsAree
    ) {

        map.fitBounds(
            boundsAree,
            {
                padding:[30,30]
            }
        );

    }
}