import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import './App.css'; 

interface Analysis {
  _id: string;
  repoUrl: string;
  summaryText: string;
  createdAt?: string;
}

export default function App() {
  const [history, setHistory] = useState<Analysis[]>([]);
  const [activeAnalysis, setActiveAnalysis] = useState<Analysis | null>(null);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // 1. CARICAMENTO STORICO
  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const response = await fetch('http://localhost:3000/repo/history');
        if (response.ok) {
          const data = await response.json();
          setHistory(data);
        }
      } catch (error) {
        console.error("Errore caricamento storico:", error);
      }
    };
    fetchHistory();
  }, []);

  // 2. NUOVA ANALISI
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    setIsProcessing(true);
    const tempId = Date.now().toString();
    const tempAnalysis: Analysis = { _id: tempId, repoUrl: input, summaryText: '' };
    setActiveAnalysis(tempAnalysis); 

    try {
      const response = await fetch('http://localhost:3000/repo/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repoUrl: input }),
      });

      if (!response.ok) throw new Error(response.statusText);

      const realData = await response.json();
      const newAnalysis: Analysis = {
        _id: realData._id,
        repoUrl: realData.repoUrl,
        summaryText: realData.summaryText
      };

      setActiveAnalysis(newAnalysis);
      setHistory(prev => [newAnalysis, ...prev]);
      setInput('');

    } catch (error) {
      console.error(error);
      setActiveAnalysis(prev => prev ? { ...prev, summaryText: "⚠️ Errore durante l'analisi. Riprova." } : null);
    } finally {
      setIsProcessing(false);
    }
  };

  const getRepoName = (url: string) => {
    try {
      const parts = url.split('/');
      return parts.length >= 2 ? `${parts[parts.length - 2]}/${parts[parts.length - 1]}` : url;
    } catch {
      return url;
    }
  };

  return (
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
                  {item.summaryText.slice(0, 60).replace(/[#*`]/g, '')}...
                </div>
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="main-content">
        
        {/* HEADER */}
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

        {/* DISPLAY AREA */}
        <div className="content-area">
          {!activeAnalysis ? (
            <div className="empty-state">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" style={{ marginBottom: '1rem' }}>
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                <polyline points="14 2 14 8 20 8"></polyline>
                <line x1="16" y1="13" x2="8" y2="13"></line>
                <line x1="16" y1="17" x2="8" y2="17"></line>
                <polyline points="10 9 9 9 8 9"></polyline>
              </svg>
              <p>Seleziona un'analisi dallo storico o inserisci un nuovo URL</p>
            </div>
          ) : isProcessing && !activeAnalysis.summaryText ? (
            <div className="loading-state">
              <div className="loading-badge">Generazione riassunto con AI in corso...</div>
            </div>
          ) : (
            <div className="markdown-container">
               <ReactMarkdown>{activeAnalysis.summaryText}</ReactMarkdown>
            </div>
          )}
        </div>

        {/* INPUT AREA */}
        <div className="input-section">
          <form onSubmit={handleSubmit} className="input-form">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Incolla URL GitHub (es. https://github.com/facebook/react)"
              disabled={isProcessing}
              className="url-input"
            />
            <button
              type="submit"
              disabled={!input.trim() || isProcessing}
              className="submit-btn"
            >
              {isProcessing ? 'Analisi...' : 'Analizza'}
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}