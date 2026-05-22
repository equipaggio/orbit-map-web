from flask import Flask, request, Response
import requests

app = Flask(__name__)

@app.route("/")
def home():
    return "ORBIT MAP WEB PROXY OK"

@app.route("/proxy")
def proxy():
    url = request.args.get("url", "")

    if not url:
        return Response("URL mancante", status=400)

    try:
        r = requests.get(url, timeout=30)

        return Response(
            r.content,
            status=r.status_code,
            content_type="application/vnd.google-earth.kml+xml",
            headers={
                "Access-Control-Allow-Origin": "*"
            }
        )

    except Exception as e:
        return Response(
            "Errore proxy: " + str(e),
            status=500,
            headers={
                "Access-Control-Allow-Origin": "*"
            }
        )

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000)