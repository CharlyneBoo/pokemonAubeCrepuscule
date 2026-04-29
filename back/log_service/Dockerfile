# Utiliser l'image officielle Python
FROM python:3.11-slim

# Définir le répertoire de travail
WORKDIR /app
# Copier les fichiers requirements
COPY requirements.txt .
# Installer les dépendances
RUN pip install --no-cache-dir -r requirements.txt

# Copier le code de l'application
COPY app ./app

# Exposer le port FastAPI
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

# Commande pour lancer FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
