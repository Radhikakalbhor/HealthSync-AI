'use client';

import React, { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import {
  Bot,
  Send,
  Sparkles,
  FileText,
  User,
  Plus,
  Trash2,
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  ChevronRight,
  MessageSquare,
} from 'lucide-react';
import { api } from '@/lib/api';
import { ChatConversation, ChatMessage } from '@/types';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AssistantPage() {
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const samplePrompts = [
    'What medicines were prescribed to me recently?',
    'Summarize my latest blood test report.',
    'What was my HbA1c value in my last lab report?',
    'Which doctor issued my prescription?',
  ];

  const fetchConversations = async () => {
    setLoading(true);
    try {
      const list = await api.listConversations();
      setConversations(list || []);
      if (list && list.length > 0 && !activeConvId) {
        setActiveConvId(list[0].id);
        loadConversation(list[0].id);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (convId: string) => {
    try {
      const conv = await api.getConversation(convId);
      setMessages(conv.messages || []);
      setActiveConvId(convId);
    } catch {
      setMessages([]);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCreateNewConversation = async () => {
    try {
      const newConv = await api.createConversation('New Health Record Consultation');
      setConversations([newConv, ...conversations]);
      setActiveConvId(newConv.id);
      setMessages([]);
    } catch (err: any) {
      alert(`Could not start new chat: ${err?.message || 'Error'}`);
    }
  };

  const handleDeleteConversation = async (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this conversation history?')) return;
    try {
      await api.deleteConversation(convId);
      const remaining = conversations.filter((c) => c.id !== convId);
      setConversations(remaining);
      if (activeConvId === convId) {
        if (remaining.length > 0) {
          setActiveConvId(remaining[0].id);
          loadConversation(remaining[0].id);
        } else {
          setActiveConvId(null);
          setMessages([]);
        }
      }
    } catch (err: any) {
      alert(`Could not delete conversation: ${err?.message || 'Error'}`);
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = textToSend || inputQuery;
    if (!query.trim()) return;

    let targetConvId: string | null = activeConvId;
    if (!targetConvId) {
      try {
        const newConv = await api.createConversation(query.slice(0, 35));
        setConversations([newConv, ...conversations]);
        targetConvId = newConv.id;
        setActiveConvId(newConv.id);
      } catch {
        return;
      }
    }

    if (!targetConvId) return;

    // Add optimistic user message
    const tempUserMsg: ChatMessage = {
      id: 'temp-' + Date.now(),
      conversation_id: targetConvId,
      role: 'user',
      content: query.trim(),
      citations: [],
      created_at: new Date().toISOString(),
      disclaimer: '',
    };
    setMessages((prev) => [...prev, tempUserMsg]);
    setInputQuery('');
    setSending(true);

    try {
      const assistantReply = await api.askAssistant(targetConvId, query.trim());
      setMessages((prev) => [...prev.filter((m) => m.id !== tempUserMsg.id), tempUserMsg, assistantReply]);
    } catch (err: any) {
      alert(`Assistant error: ${err?.message || 'Could not process query'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6 max-w-7xl mx-auto pb-4 animate-in fade-in duration-300">
      {/* Left Sidebar: Conversations History */}
      <Card className="hidden md:flex flex-col w-72 overflow-hidden shrink-0 shadow-sm">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-health-600" />
            <h2 className="font-bold text-xs uppercase tracking-wider text-navy-900 font-display">
              Chat History
            </h2>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCreateNewConversation}
            className="w-8 h-8 rounded-lg bg-health-50 text-health-600 hover:bg-health-100"
            title="Start New Chat"
          >
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {conversations.length === 0 ? (
            <div className="py-8 text-center text-xs text-navy-400">
              No chat history yet. Ask a question below to start!
            </div>
          ) : (
            conversations.map((c) => {
              const isActive = c.id === activeConvId;
              return (
                <div
                  key={c.id}
                  onClick={() => loadConversation(c.id)}
                  className={`group px-3 py-2.5 rounded-xl text-xs font-semibold cursor-pointer transition-all flex items-center justify-between ${
                    isActive
                      ? 'bg-health-50 text-health-700 shadow-2xs'
                      : 'text-navy-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="truncate pr-2">{c.title}</span>
                  <button
                    onClick={(e) => handleDeleteConversation(c.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-1 rounded hover:text-rose-600 transition-opacity cursor-pointer"
                    title="Delete Chat"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="p-3 bg-slate-50 border-t border-slate-100 text-[10px] text-navy-500 flex items-center gap-1.5">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-500 shrink-0" />
          <span>Patient-isolated RAG: Searches strictly your own records.</span>
        </div>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col overflow-hidden shadow-sm">
        {/* Chat Header */}
        <div className="px-6 py-3.5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-health-600 to-teal-500 text-white flex items-center justify-center shadow-xs">
              <Bot className="w-4 h-4" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-navy-950 font-display">AI Medical Records Assistant</h1>
              <p className="text-[11px] text-navy-500">
                Citation-backed responses from your uploaded health documents
              </p>
            </div>
          </div>

          <Badge variant="teal" className="hidden sm:flex items-center gap-1.5 text-xs">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Zero-Hallucination Safe Mode</span>
          </Badge>
        </div>

        {/* Message Thread */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {messages.length === 0 ? (
            <div className="py-12 text-center max-w-md mx-auto space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-health-50 text-health-600 flex items-center justify-center mx-auto shadow-xs">
                <Bot className="w-7 h-7" />
              </div>
              <div>
                <h3 className="font-bold text-base text-navy-950 font-display">
                  Ask anything about your health records
                </h3>
                <p className="text-xs text-navy-500 mt-1 leading-relaxed">
                  The assistant retrieves facts directly from your verified prescriptions and lab reports, providing verifiable source document links for every claim.
                </p>
              </div>

              {/* Sample Prompt Chips */}
              <div className="pt-2 text-left space-y-2">
                <p className="text-[11px] font-bold text-navy-400 uppercase tracking-wider text-center">
                  Suggested Questions
                </p>
                {samplePrompts.map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSendMessage(prompt)}
                    className="w-full text-left p-3 rounded-xl border border-slate-200 hover:border-health-400 bg-slate-50 hover:bg-health-50/50 text-xs font-semibold text-navy-800 transition-all flex items-center justify-between cursor-pointer"
                  >
                    <span>{prompt}</span>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          ) : (
            messages.map((m) => {
              const isUser = m.role === 'user';
              return (
                <div
                  key={m.id}
                  className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}
                >
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-health-100 text-health-700 flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className={`max-w-xl space-y-2.5 ${isUser ? 'items-end' : 'items-start'}`}>
                    {/* Bubble */}
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed whitespace-pre-wrap ${
                        isUser
                          ? 'bg-health-600 text-white rounded-br-none shadow-sm'
                          : 'bg-slate-50 border border-slate-200 text-navy-900 rounded-bl-none shadow-card'
                      }`}
                    >
                      {m.content}
                    </div>

                    {/* Verifiable Citations */}
                    {!isUser && m.citations && m.citations.length > 0 && (
                      <div className="space-y-1.5 pt-1">
                        <p className="text-[10px] font-bold text-navy-400 uppercase tracking-wider">
                          Referenced Document Sources ({m.citations.length})
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {m.citations.map((c, cIdx) => (
                            <Link
                              key={cIdx}
                              href={`/documents/${c.document_id}/review`}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white border border-teal-200 text-teal-800 text-[11px] font-semibold hover:bg-teal-50 transition-colors shadow-2xs"
                              title={c.snippet}
                            >
                              <FileText className="w-3 h-3 text-teal-600" />
                              <span className="truncate max-w-[180px]">{c.document_filename}</span>
                              <ExternalLink className="w-2.5 h-2.5 text-teal-500" />
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Safety Disclaimer */}
                    {!isUser && m.disclaimer && (
                      <p className="text-[10px] text-navy-400 italic">
                        {m.disclaimer}
                      </p>
                    )}
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-slate-200 text-navy-700 flex items-center justify-center font-bold text-xs shrink-0 mt-1">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>
              );
            })
          )}

          {sending && (
            <div className="flex gap-3 justify-start items-center">
              <div className="w-8 h-8 rounded-xl bg-health-100 text-health-700 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4" />
              </div>
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-navy-500 flex items-center gap-2">
                <div className="w-3.5 h-3.5 border-2 border-health-600 border-t-transparent rounded-full animate-spin" />
                <span>Searching your medical records & synthesizing citations...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-4 bg-white border-t border-slate-200">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2.5"
          >
            <Input
              type="text"
              value={inputQuery}
              onChange={(e) => setInputQuery(e.target.value)}
              placeholder="Ask about medications, lab results, doctors, or medical documents..."
              disabled={sending}
              className="flex-1 text-xs sm:text-sm"
            />
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={!inputQuery.trim() || sending}
              className="shadow-sm px-4"
              title="Send Message"
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
          <div className="mt-2 text-center text-[10px] text-navy-400">
            HealthSync AI never provides clinical diagnoses or changes treatment regimens. Always consult your doctor.
          </div>
        </div>
      </Card>
    </div>
  );
}
