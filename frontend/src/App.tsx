import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { api, API_URL, type Analysis } from './services/api'; // Importa API_URL
import './App.css';

export default function App() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const [input, setInput] = useState('');
  
  // Stati per il caricamento granulare
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState<string>(''); // Testo dello step corrente

  useEffect(() => {
    const loadHistory = async () => {
      try {
        const data = await api.getHistory();
        setHistory(data);
      } catch (error) {
        console.error("Errore caricamento storico:", error);
      }
    };
    loadHistory();
  }, []);

  // GESTIONE STREAMING (SSE)
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    setLoadingStatus('Inizializzazione connessione...');
    
    // Creiamo un placeholder temporaneo
    const tempId = 'temp-' + Date.now();
    const tempAnalysis: Analysis = { _id: tempId, repoUrl: input, summaryText: '' };
    setActiveAnalysis(tempAnalysis);

    // Apriamo la connessione SSE
    const eventSource = new EventSource(`${API_URL}/repo/analyze/stream?url=${encodeURIComponent(input)}`);

    eventSource.onmessage = (event) => {
      const parsedData = JSON.parse(event.data);

      if (parsedData.type === 'status') {
        // Aggiorna solo il testo di stato
        setLoadingStatus(parsedData.message);
      } 
      else if (parsedData.type === 'result') {
        // Analisi completata
        const finalAnalysis = parsedData.payload;
        setActiveAnalysis(finalAnalysis);
        setHistory(prev => [finalAnalysis, ...prev]);
        setIsProcessing(false);
        setLoadingStatus('');
        setInput('');
        eventSource.close(); // Chiudi connessione
      } 
      else if (parsedData.type === 'error') {
        // Gestione errore dal backend
        console.error("Errore Stream:", parsedData.message);
        setActiveAnalysis(prev => prev ? { ...prev, summaryText: `⚠️ Errore: ${parsedData.message}` } : null);
        setIsProcessing(false);
        setLoadingStatus('');
        eventSource.close();
      }
    };

    eventSource.onerror = () => {
        // Errore di connessione generico (es. server down)
        if (eventSource.readyState !== EventSource.CLOSED) {
             console.error("Errore connessione SSE");
             setIsProcessing(false);
             setLoadingStatus('');
             eventSource.close();
        }
    };
  };

  // NUOVO: Gestione Cancellazione
  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Evita di selezionare la card quando si clicca elimina
    if (!window.confirm("Vuoi davvero eliminare questa analisi?")) return;

    try {
      await api.deleteAnalysis(id);
      setHistory(prev => prev.filter(item => item._id !== id));
      if (activeAnalysis?._id === id) {
        setActiveAnalysis(null);
      }
    } catch (error) {
      alert("Errore durante l'eliminazione");
    }
  };

  const getRepoName = (url: string) => {
    try {
      const parts = url.split('/');
      return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : url;
    } catch { return url; }
  };

  return (
      <div className="app-container">
        <aside className="sidebar">
          <div className="sidebar-header">
            <h2 className="sidebar-title">Storico Analisi</h2>
            <p className="sidebar-subtitle">{history.length} repository analizzate</p>
          </div>
  
          <div className="history-list">
            {history.map((item) => (
              <div 
                key={item._id}
                onClick={() => setActiveAnalysis(item)}
                className={`history-item ${activeAnalysis?._id === item._id ? 'active' : ''}`}
              >
                <div className="history-text-container">
                  <div className="repo-name">{getRepoName(item.repoUrl)}</div>
                  <div className="repo-snippet">
                    {item.summaryText ? item.summaryText.slice(0, 50) + '...' : 'In elaborazione...'}
                  </div>
                </div>
                {/* Tasto Elimina */}
                <button 
                  className="delete-btn"
                  onClick={(e) => handleDelete(e, item._id)}
                  title="Elimina"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </aside>
  
        <main className="main-content">
          <header className="main-header">
            <h1 className="main-title">
              {activeAnalysis ? getRepoName(activeAnalysis.repoUrl) : 'Repo Summarizer AI'}
            </h1>
            {activeAnalysis && !activeAnalysis._id.startsWith('temp') && (
              <a href={activeAnalysis.repoUrl} target="_blank" rel="noreferrer" className="github-link">
                Apri su GitHub ↗
              </a>
            )}
          </header>
  
          <div className="content-area">
            {!activeAnalysis ? (
              <div className="empty-state">
                <p>Seleziona un'analisi dallo storico o inserisci un nuovo URL</p>
              </div>
            ) : isProcessing && !activeAnalysis.summaryText ? (
              // STATO DI CARICAMENTO GRANULARE
              <div className="loading-state">
                <div className="loading-badge">
                   <span className="spinner">⟳</span> {loadingStatus}
                </div>
              </div>
            ) : (
              <div className="markdown-container">
                 <ReactMarkdown>{activeAnalysis.summaryText}</ReactMarkdown>
              </div>
            )}
          </div>
  
          <div className="input-section">
            <form onSubmit={handleSubmit} className="input-form">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Incolla URL GitHub"
                disabled={isProcessing}
                className="url-input"
              />
              <button type="submit" disabled={!input.trim() || isProcessing} className="submit-btn">
                {isProcessing ? 'Attendere...' : 'Analizza'}
              </button>
            </form>
          </div>
        </main>
      </div>
  );
}