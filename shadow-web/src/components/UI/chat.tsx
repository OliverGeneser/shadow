import { useEffect, useRef, useState } from "react";
import { Textarea } from "./textarea";
import { button } from "./button";
import { store, useChatMessages, useClientId } from "../../store";

export function Chat() {
  const chatMessages = useChatMessages();
  const user = useClientId();

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const sendMessage = () => {
    const message = input.trim();
    if (!message) return;
    store.trigger.sendChatMessage({
      message: message,
    });
    store.trigger.setNewChatMessage({
      peerId: user!,
      message,
    });
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="mx-auto flex h-full w-72 flex-col rounded-l-lg border border-gray-300 bg-gray-50 shadow-lg sm:w-96">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {chatMessages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.user === user ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-xs">
                <p
                  className={`flex ${
                    msg.user === user ? "justify-end" : "justify-start"
                  } text-xs text-gray-500`}
                >
                  By {msg.user}
                </p>
                <div
                  className={`${
                    msg.user === user ? "bg-blue-500" : "bg-gray-200"
                  } rounded-2xl p-2`}
                >
                  <p
                    className={`max-w-full font-mono text-base font-semibold break-words whitespace-pre-wrap ${
                      msg.user === user ? "text-gray-100" : "text-gray-800"
                    }`}
                  >
                    {msg.text}
                  </p>
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <div className="items-center space-x-2 border-t border-gray-300 p-4 pt-1">
        {/* display on mobile  */}
        <button
          className={button({
            color: "primary",
            size: "sm",
            className: "float-end mb-2",
          })}
          onClick={sendMessage}
        >
          SEND
        </button>
        <Textarea
          value={input}
          onChange={(str) => setInput(str)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
}
