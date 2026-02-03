const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Analysis {
  _id: string;
  repoUrl: string;
  summaryText: string;
  createdAt?: string;
}

export const api = {
  /**
   * Recupera lo storico delle analisi
   */
  getHistory: async (): Promise<Analysis[]> => {
    const response = await fetch(`${API_URL}/repo/history`);
    if (!response.ok) throw new Error('Errore nel recupero dello storico');
    return response.json();
  },

  /**
   * Avvia una nuova analisi
   */
  analyzeRepo: async (repoUrl: string): Promise<Analysis> => {
    const response = await fetch(`${API_URL}/repo/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ repoUrl }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || 'Errore durante l\'analisi');
    }

    return response.json();
  }
};