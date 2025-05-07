"use client";

import { useEffect, useRef, useState } from "react";
import { Textarea } from "./textarea";
import { button } from "./button";

type Message = {
  id: number;
  user: string;
  text: string;
  isUser?: boolean;
};

export function Chat() {
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, user: "Pony", text: "Hello!" },
    { id: 2, user: "Dolphin", text: "Hello!" },
    { id: 3, user: "Pony", text: "Want to transfer some files?" },
    { id: 4, user: "Owl", text: "I have some Linux ISO's!" },
    { id: 5, user: "Owlss", text: "o" },
  ]);

  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = () => {
    if (!input.trim()) return;
    //send message .then()=>setMessages
    setMessages([
      ...messages,
      { id: messages.length + 1, user: "You", text: input, isUser: true },
    ]);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div className="mx-auto flex h-full w-72 flex-col rounded-l-lg border border-gray-300  bg-gray-50 shadow-lg sm:w-96">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-xs">
                <p
                  className={`flex ${
                    msg.isUser ? "justify-end" : "justify-start"
                  } text-xs text-gray-500`}
                >
                  By {msg.user}
                </p>
                <div
                  className={`${
                    msg.isUser ? "bg-blue-500" : "bg-gray-200"
                  } rounded-2xl p-2`}
                >
                  <p
                    className={`max-w-full font-mono text-base font-semibold break-words whitespace-pre-wrap ${
                      msg.isUser ? "text-gray-100" : "text-gray-800"
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
