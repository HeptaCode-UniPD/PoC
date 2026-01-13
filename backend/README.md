# Repo Summarizer

Un backend in NestJS che analizza repository GitHub e genera riassunti tecnici usando Google Gemini AI.

## Prerequisiti

Assicurati di avere un file `.env` nella root del progetto con queste chiavi:

GITHUB_TOKEN=tuo_token_github
GEMINI_API_KEY=tua_chiave_google
MONGO_URI=mongodb://localhost/repo-summarizer

# Crea e lancia il container MongoDB in background:
docker run -d --name my-mongo -p 27017:27017 mongo

# Installa le dipendenze (solo la prima volta)
npm install

# Avvia il Server in modalità watch (ascolta le modifiche ai file):
spostati nella cartella repo-summarizer
npm run start:dev

# Esempio di richiesta POST:
curl -X POST http://localhost:3000/repo/analyze \
   -H "Content-Type: application/json" \
   -d '{"repoUrl": "https://github.com/vercel/ms"}'

# Esempio di richiesta GET:
curl http://localhost:3000/repo/history