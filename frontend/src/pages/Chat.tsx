import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, Sparkles, User } from "lucide-react";
import axios from "axios";
import { api } from "@/services/api";
import { Card } from "@/components/ui/Card";
import type { ChatMessage } from "@/types";
import { cn } from "@/utils/cn";


export function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiReady, setAiReady] = useState<boolean | null>(null);
  const [aiModel, setAiModel] = useState<string | null>(null);
  const [quotaWarning, setQuotaWarning] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .chatStatus()
      .then(({ data }) => {
        const live = data.available && data.verified !== false;
        setAiReady(live);
        setAiModel(data.model);
        if (!live) {
          setMessages([
            {
              role: "assistant",
              content: data.available
                ? `Gemini key is set but the model could not be reached (${data.error || "check GEMINI_MODEL"}). Set \`GEMINI_MODEL=gemini-2.5-flash\` in backend/.env and restart.`
                : "**Gemini is not connected.** Add `GEMINI_API_KEY` to `backend/.env` and restart the API server.",
            },
          ]);
        } else {
          const saved = localStorage.getItem("echo_chat_history");
          if (saved) {
            try {
              setMessages(JSON.parse(saved));
            } catch {
              setMessages([]);
            }
          }
        }
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
    localStorage.setItem("echo_chat_history", JSON.stringify(nextMessages));
    setLoading(true);

    try {
      const history = messages.filter((m) => m.role === "user" || m.role === "assistant");
      const { data } = await api.chat(userMsg, history);
      const updatedMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: data.reply }];
      setMessages(updatedMessages);
      localStorage.setItem("echo_chat_history", JSON.stringify(updatedMessages));
      if (data.error_code === "quota_exceeded") {
        setQuotaWarning(true);
      } else if (data.error_code === "not_configured") {
        setAiReady(false);
      }
    } catch (err) {
      let msg = "Unable to reach ECHO backend. Is the API running on port 8000?";
      if (axios.isAxiosError(err)) {
        if (err.code === "ECONNABORTED") {
          msg = "Request timed out — Gemini is still thinking. Try a shorter question or wait and retry.";
        } else if (err.response?.data?.detail) {
          msg = String(err.response.data.detail);
        } else if (err.response?.status === 500) {
          msg = "Server error during chat. Restart the backend and try again.";
        }
      }
      const errMessages: ChatMessage[] = [...nextMessages, { role: "assistant", content: msg }];
      setMessages(errMessages);
      localStorage.setItem("echo_chat_history", JSON.stringify(errMessages));
    } finally {
      setLoading(false);
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <div className="mx-auto flex h-[calc(100vh-3rem)] max-w-3xl flex-col space-y-4">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Incident Assistant</h1>
          <p className="text-sm text-slate-500">
            Detailed Gemini analysis grounded in live system data
          </p>
        </div>
        {messages.length > 0 && aiReady === true && (
          <button
            onClick={() => {
              setMessages([]);
              localStorage.removeItem("echo_chat_history");
            }}
            className="rounded-lg border border-slate-700 bg-slate-800/40 px-3 py-1.5 text-xs text-slate-400 hover:border-rose-500/30 hover:text-rose-400 transition-colors"
          >
            Clear History
          </button>
        )}
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
      {quotaWarning && (
        <div className="rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2 text-xs text-orange-200">
          Gemini free-tier quota hit. Answers use live incident data. Add{" "}
          <code className="text-orange-100">GEMINI_MODEL=gemini-2.5-flash</code> to backend/.env or
          retry in ~1 minute.
        </div>
      )}

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
                  "max-w-[90%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed",
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
