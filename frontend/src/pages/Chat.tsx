import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { api } from "@/services/api";
import { Card } from "@/components/ui/Card";
import type { ChatMessage } from "@/types";
import { cn } from "@/utils/cn";

const SUGGESTIONS = [
  "Why did the payment API fail?",
  "Which service is unstable right now?",
  "Summarize the most recent incident and what we should do first.",
];

export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .chatStatus()
      .then(({ data }) => {
        setAiReady(data.available);
        setAiModel(data.model);
        setMessages([
          {
            role: "assistant",
            content: data.available
              ? `ECHO (${data.model}) — short, context-aware answers from live logs and incidents. Run a simulation first, then ask your question.`
              : "**Gemini is not connected.** Add `GEMINI_API_KEY` to `backend/.env` and restart the API server. Get a key at https://aistudio.google.com/apikey",
          },
        ]);
      })
      .catch(() => {
        setAiReady(false);
        setMessages([
          {
            role: "assistant",
            content: "Cannot reach the backend. Start the API server on port 8000 first.",
          },
        ]);
      });
  }, []);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: userMsg }];
    setMessages(nextMessages);
    setLoading(true);

    try {
      const history = messages.filter((m) => m.role === "user" || m.role === "assistant");
      const { data } = await api.chat(userMsg, history);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
      if (!data.ai_powered) setAiReady(false);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Unable to reach ECHO backend. Is the API running?" },
      ]);
    } finally {
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-3xl flex-col space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-white">AI Incident Assistant</h1>
        <p className="text-sm text-slate-500">
          Concise Gemini responses grounded in live system data
        </p>
      </header>

      {aiReady === true && aiModel && (
        <div className="flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-300">
          <Sparkles className="h-3.5 w-3.5" />
          Gemini active ({aiModel})
        </div>
      )}
      {aiReady === false && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          Set <code className="text-amber-200">GEMINI_API_KEY</code> in backend/.env and restart
          uvicorn to enable real AI responses.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            disabled={loading}
            className="rounded-full border border-echo-border bg-echo-card px-3 py-1 text-xs text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400 disabled:opacity-50"
          >
            {s}
          </button>
        ))}
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div className="flex-1 space-y-4 overflow-y-auto p-2">
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn("flex gap-3", msg.role === "user" && "flex-row-reverse")}
            >
              <div
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  msg.role === "assistant"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-slate-700 text-slate-300"
                )}
              >
                {msg.role === "assistant" ? (
                  <Bot className="h-4 w-4" />
                ) : (
                  <User className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  "max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                  msg.role === "assistant"
                    ? "bg-slate-800/80 text-slate-300"
                    : "bg-cyan-600/20 text-slate-200"
                )}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {loading && (
            <p className="text-center text-xs text-cyan-500/80">Thinking…</p>
          )}
          <div ref={bottomRef} />
        </div>

        <form
          className="mt-4 flex gap-2 border-t border-echo-border pt-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about incidents, services, or logs…"
            disabled={loading}
            className="flex-1 rounded-lg border border-echo-border bg-slate-900/50 px-4 py-2.5 text-sm outline-none focus:border-cyan-500/50 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-cyan-600 px-4 py-2.5 text-white hover:bg-cyan-500 disabled:opacity-50"
          >
            <Send className="h-4 w-4" />
          </button>
        </form>
      </Card>
    </div>
  );
}
