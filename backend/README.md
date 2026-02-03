# Repo Summarizer

Backend in NestJS che analizza repository GitHub e genera revisioni tecniche (QA/Audit) utilizzando **AWS Bedrock (Amazon Nova Micro)**.

## Caratteristiche
- **Clonazione Ottimizzata**: Usa `git clone --depth 1` per velocizzare il download e ridurre il traffico.
- **Context Aware**: Seleziona intelligentemente i file sorgente per riempire la finestra di contesto dell'AI senza tagliare il codice a metà.
- **Analisi AI**: Genera report strutturati su qualità del codice, struttura e mancanze.

## Prerequisiti

Crea un file `.env` nella root del progetto (o passa le variabili al container Docker):

```env
# Database
MONGO_URI=mongodb://localhost/repo-summarizer

# AWS Credentials (Richiede permessi per Bedrock:InvokeModel)
AWS_ACCESS_KEY_ID=tuo_access_key
AWS_SECRET_ACCESS_KEY=tuo_secret_key
AWS_SESSION_TOKEN=opzionale_se_usate_sso
AWS_REGION=us-east-1 (o eu-central-1 dove Nova è disponibile)

# Configurazione App
PORT=3000
FRONTEND_URL=http://localhost:5173