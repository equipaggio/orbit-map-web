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

@app.route("/reveal-token", methods=["POST"])
def reveal_token():
    secret_key = request.form.get("secret_key", "")

    if not secret_key:
        return Response("SECRET_KEY mancante", status=400)

    try:
        url = "https://eu.onetimesecret.com/api/v2/guest/secret/" + secret_key + "/reveal"

        r = requests.post(url, timeout=30)

        return Response(
            r.content,
            status=r.status_code,
            content_type="application/json",
            headers={
                "Access-Control-Allow-Origin": "*"
            }
        )

    except Exception as e:
        return Response(
            "Errore reveal token: " + str(e),
            status=500,
            headers={
                "Access-Control-Allow-Origin": "*"
            }
        )
    
if __name__ == "__main__":
    import os

    port = int(os.environ.get("PORT", 8000))

    app.run(
        host="0.0.0.0",
        port=port
    )