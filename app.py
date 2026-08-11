from dotenv import load_dotenv
from flask import Flask, request, jsonify, render_template
from datetime import datetime
import os
import requests
import json
import pdfplumber

from database import initialize_db, save_doc, get_history

load_dotenv()
API_KEY = os.getenv("API_KEY")  # no se usa todavía (modelo local), queda listo para el swap a nube

app = Flask(__name__)


def extract_text(pdf_path):
    text = ""
    with pdfplumber.open(pdf_path) as pdf:
        for page in pdf.pages:
            content = page.extract_text()
            if content:
                text += content + "\n"
    return text


def build_prompt(texto_documento):
    return f"""Eres un asistente de estudio. Analiza el siguiente material y genera:

1. Un resumen claro de 150-200 palabras, enfocado en los conceptos clave.
2. Exactamente 5 preguntas de repaso que evalúen comprensión, cada una con su respuesta correcta.
3. Utiliza saltos de linea para diferenciar cada pregunta y respuesta para tener una estructura clara para la lectura.
4. añadir referencias de que parte del documento fue sacada la información, tanto en el resumen como en las respuestas a las preguntas
5. Las preguntas y respuestas deben ser relevantes, no cuestionar información trivial o irrelevante

Responde ÚNICAMENTE en este formato JSON, sin texto adicional:
{{"summary": "...", "questions": [{{"question": "...", "answer": "..."}}]}}

Material:
{texto_documento[:8000]}
"""


def generate_response_sumary_and_questions(document_text):
    prompt = build_prompt(document_text)

    response = requests.post("http://localhost:11434/api/generate", json={
        "model": "llama3.2:3b",
        "prompt": prompt,
        "format": "json",
        "stream": False
    })

    try:
        return json.loads(response.json()["response"])
    except (json.JSONDecodeError, KeyError):
        stricter_prompt = prompt + "\n\n IMPORTANTE: responde SOLO con el JSON, sin ningún texto antes o después."
        response = requests.post("http://localhost:11434/api/generate", json={
            "model": "llama3.2:3b",
            "prompt": stricter_prompt,
            "format": "json",
            "stream": False
        })
        return json.loads(response.json()["response"])


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/historial")
def history_page():
    return render_template("history.html")


@app.route("/api/process", methods=["POST"])
def process_doc():
    archive = request.files.get("archive")
    if not archive:
        return jsonify({"error": "No file uploaded"}), 400

    temp_path = os.path.join("uploads", archive.filename)
    archive.save(temp_path)

    text = extract_text(temp_path)
    os.remove(temp_path)  # limpieza antes de procesar, ya no necesitamos el archivo físico

    if not text:
        return jsonify({"error": "No se pudo extraer texto del PDF"}), 422

    result = generate_response_sumary_and_questions(text)

    save_doc(
        archive.filename,
        datetime.now().isoformat(),
        result["summary"],
        json.dumps(result["questions"])
    )
    return jsonify(result)


@app.route("/api/history", methods=["GET"])
def history():
    rows = get_history()
    return jsonify([{"id": r[0], "title": r[1], "created_at": r[2]} for r in rows])


if __name__ == "__main__":
    initialize_db()
    os.makedirs("uploads", exist_ok=True)
    app.run(debug=True)
