import React, { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatSummarizer() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isProcessing) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    setTimeout(() => {
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `I've analyzed the content from:\n${input}\n\nHere's a summary of the key points:\n\n• Main topic identified\n• Important sections highlighted\n• Key takeaways compiled`,
      };

      setMessages(prev => [...prev, assistantMessage]);
      setIsProcessing(false);
    }, 1500);
  };

  return (
    <>
      <style>{`
        body {
          margin: 0;
          padding: 0;
        }
      `}</style>
      <div style={{
        width: '100%',
        minHeight: '100vh',
        background: 'linear-gradient(to bottom, #0f172a, #020617)',
        color: '#f1f5f9',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{ width: '100%', maxWidth: '56rem', display: 'flex', flexDirection: 'column', height: '100vh' }}>
          
          {/* Header */}
          <div style={{ padding: '2rem 1.5rem 1.5rem', borderBottom: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '2.5rem', height: '2.5rem', background: '#2563eb', borderRadius: '0.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                  <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                  <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                </svg>
              </div>
              <div>
                <h1 style={{ fontSize: '1.25rem', fontWeight: '600', color: 'white', margin: 0 }}>Link Summarizer</h1>
                <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>Paste a link to get a summary</p>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '2rem 1.5rem' }}>
            {messages.length === 0 ? (
              <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ textAlign: 'center', maxWidth: '28rem' }}>
                  <div style={{ width: '4rem', height: '4rem', background: 'linear-gradient(to bottom right, #2563eb, #06b6d4)', borderRadius: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
                    <svg width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth={2}>
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                  </div>
                  <h2 style={{ fontSize: '1.25rem', fontWeight: '500', color: '#e2e8f0', marginBottom: '0.5rem' }}>Ready to summarize</h2>
                  <p style={{ fontSize: '0.875rem', color: '#94a3b8', margin: 0 }}>
                    Drop a link below and I will extract and summarize the content for you
                  </p>
                </div>
              </div>
            ) : (
              <div style={{ width: '100%', maxWidth: '48rem', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                {messages.map((message) => (
                  <div key={message.id} style={{ width: '100%' }}>
                    {message.role === 'user' ? (
                      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                        <div style={{ background: '#2563eb', color: 'white', padding: '0.625rem 1rem', borderRadius: '1rem', borderTopRightRadius: '0.25rem', maxWidth: '32rem', wordBreak: 'break-all' }}>
                          <p style={{ fontSize: '0.875rem', fontFamily: 'monospace', margin: 0 }}>{message.content}</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                        <div style={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9', padding: '0.75rem 1rem', borderRadius: '1rem', borderTopLeftRadius: '0.25rem', maxWidth: '32rem' }}>
                          <p style={{ fontSize: '0.875rem', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>{message.content}</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {isProcessing && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start', width: '100%' }}>
                    <div style={{ background: '#1e293b', border: '1px solid #334155', padding: '0.75rem 1rem', borderRadius: '1rem', borderTopLeftRadius: '0.25rem' }}>
                      <div style={{ display: 'flex', gap: '0.375rem' }}>
                        <div style={{ width: '0.5rem', height: '0.5rem', background: '#3b82f6', borderRadius: '9999px' }}></div>
                        <div style={{ width: '0.5rem', height: '0.5rem', background: '#3b82f6', borderRadius: '9999px' }}></div>
                        <div style={{ width: '0.5rem', height: '0.5rem', background: '#3b82f6', borderRadius: '9999px' }}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Input */}
          <div style={{ padding: '1.5rem', borderTop: '1px solid #334155', background: '#0f172a' }}>
            <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: '48rem', margin: '0 auto' }}>
              <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <svg style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', width: '1rem', height: '1rem', color: '#64748b', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                  </svg>
                  <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="https://github.com/repository-name"
                    disabled={isProcessing}
                    style={{
                      width: '100%',
                      paddingLeft: '2.75rem',
                      paddingRight: '1rem',
                      paddingTop: '0.75rem',
                      paddingBottom: '0.75rem',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '0.75rem',
                      color: 'white',
                      fontSize: '0.875rem',
                      fontFamily: 'monospace',
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
                <button
                  type="submit"
                  disabled={!input.trim() || isProcessing}
                  style={{
                    padding: '0.75rem 1.5rem',
                    background: isProcessing || !input.trim() ? '#374151' : '#2563eb',
                    color: 'white',
                    borderRadius: '0.75rem',
                    border: 'none',
                    cursor: isProcessing || !input.trim() ? 'not-allowed' : 'pointer',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                  Summarize
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}