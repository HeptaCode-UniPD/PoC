import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { api, Analysis } from './services/api'; // Importa il nuovo service
import './App.css';

export default function App() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. CARICAMENTO STORICO VIA API SERVICE
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

  // 2. NUOVA ANALISI VIA API SERVICE
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    // Placeholder ottimistico
    const tempId = Date.now().toString();
    setActiveAnalysis({ _id: tempId, repoUrl: input, summaryText: '' });

    try {
      const newAnalysis = await api.analyzeRepo(input);
      
      setActiveAnalysis(newAnalysis);
      setHistory(prev => [newAnalysis, ...prev]);
      setInput('');
    } catch (error) {
      console.error(error);
      setActiveAnalysis(prev => prev ? { 
        ...prev, 
        summaryText: `⚠️ Errore: ${(error as Error).message}. Verifica l'URL o le credenziali AWS.` 
      } : null);
    } finally {
      setIsProcessing(false);
    }
  };

  // ... (Il resto del rendering rimane invariato: getRepoName, JSX sidebar, main content) ...
  const getRepoName = (url: string) => { /* codice esistente */ 
     try {
      const parts = url.split('/');
      return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : url;
    } catch {
      return url;
    }
  };

  return (
      // Assicurati solo di usare le variabili aggiornate sopra
      <div className="app-container">
        {/* SIDEBAR */}
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
                    {item.summaryText ? item.summaryText.slice(0, 60).replace(/[#*`]/g, '') + '...' : 'Caricamento...'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </aside>
  
        {/* MAIN CONTENT */}
        <main className="main-content">
          <header className="main-header">
            <h1 className="main-title">
              {activeAnalysis ? getRepoName(activeAnalysis.repoUrl) : 'Repo Summarizer AI'}
            </h1>
            {activeAnalysis && (
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
              <div className="loading-state">
                <div className="loading-badge">Clonazione e analisi AI in corso...</div>
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
                {isProcessing ? 'Analisi...' : 'Analizza'}
              </button>
            </form>
          </div>
        </main>
      </div>
  );
}