export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export interface Analysis {
  _id: string;
  repoUrl: string;
  summaryText: string;
  createdAt?: string;
}

export const api = {
  getHistory: async (): Promise<Analysis[]> => {
    const response = await fetch(`${API_URL}/repo/history`);
    if (!response.ok) throw new Error('Errore nel recupero dello storico');
    return response.json();
  },

  deleteAnalysis: async (id: string): Promise<void> => {
    const response = await fetch(`${API_URL}/repo/${id}`, {
      method: 'DELETE',
    });
    if (!response.ok) throw new Error('Errore durante la cancellazione');
  }
};