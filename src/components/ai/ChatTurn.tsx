import { Loader2 } from "lucide-react";
import { MathText } from "@/components/MathText";
import { messageImage, messageText, type ChatMessage } from "@/lib/ai/client";

/**
 * One turn of a Beyond AI transcript.
 *
 * Shared by the dashboard panel and the chat page so a change to the bubble —
 * or to how an attachment renders — lands in both. Assistant turns go through
 * <MathText>, which handles `$…$`, `$$…$$`, `\(…\)` and `\[…\]`; that is the
 * reason the system prompt insists on LaTeX delimiters, and nothing here parses
 * maths itself.
 */

export function ChatTurn({
  role,
  content,
  /** Strips a leading stats preamble the caller prepended for the model's benefit. */
  strip,
}: {
  role: ChatMessage["role"];
  content: ChatMessage["content"];
  strip?: RegExp;
}) {
  const image = messageImage(content);
  let text = messageText(content);
  if (strip) text = text.replace(strip, "");

  if (role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] space-y-2">
          {image && (
            <img
              src={image}
              alt="Attached"
              className="ml-auto max-h-64 rounded-2xl rounded-br-sm object-contain ring-1 ring-brand-400/40"
            />
          )}
          {text && (
            <div className="rounded-2xl rounded-br-sm bg-brand-400 px-3.5 py-2.5 text-sm font-medium text-white whitespace-pre-wrap">
              {text}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start">
      <div className="max-w-[92%] rounded-2xl rounded-bl-sm bg-brand-800 px-3.5 py-2.5 text-sm leading-relaxed text-white ring-1 ring-brand-400/30">
        {text ? (
          /* `ai-prose` styles the KaTeX output and the plain-text structure the
             model returns; MathText only handles the maths itself. */
          <MathText block className="ai-prose">
            {text}
          </MathText>
        ) : (
          <span className="inline-flex items-center gap-2 text-brand-100">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Thinking…
          </span>
        )}
      </div>
    </div>
  );
}
