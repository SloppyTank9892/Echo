import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { Bot, Send, User } from "lucide-react";
import { api } from "@/services/api";
import { Card } from "@/components/ui/Card";
import { cn } from "@/utils/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const SUGGESTIONS = [
  "Why did the payment API fail?",
  "Which service is unstable right now?",
  "Show incidents from the last 10 minutes.",
];

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "I'm ECHO, your SRE copilot. Ask about failures, service health, or recent incidents. Trigger a simulation first for the best demo experience.",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg = text.trim();
    setInput("");
    setMessages((m) => [...m, { role: "user", content: userMsg }]);
    setLoading(true);
    try {
      const { data } = await api.chat(userMsg);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
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
        <p className="text-sm text-slate-500">Natural language debugging & explanations</p>
      </header>

      <div className="flex flex-wrap gap-2">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => send(s)}
            className="rounded-full border border-echo-border bg-echo-card px-3 py-1 text-xs text-slate-400 hover:border-cyan-500/40 hover:text-cyan-400"
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
                  msg.role === "assistant" ? "bg-cyan-500/20 text-cyan-400" : "bg-slate-700 text-slate-300"
                )}
              >
                {msg.role === "assistant" ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div
                className={cn(
                  "max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
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
            <p className="text-center text-xs text-slate-500">ECHO is analyzing…</p>
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
            className="flex-1 rounded-lg border border-echo-border bg-slate-900/50 px-4 py-2.5 text-sm outline-none focus:border-cyan-500/50"
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
