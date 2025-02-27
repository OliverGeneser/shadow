"use client";

import { useEffect, useRef, useState } from "react";
import { UiButton } from "./button";
import { UiTextarea } from "./textarea";

type Message = {
  id: number;
  user: string;
  text: string;
  isUser?: boolean;
};

export function UiChat() {
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
    <div className="w-72 sm:w-96 mx-auto border rounded-lg shadow-lg bg-gray-50 h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-4">
        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.isUser ? "justify-end" : "justify-start"}`}
            >
              <div className="max-w-xs">
                <p
                  className={` flex ${
                    msg.isUser ? "justify-end" : "justify-start"
                  } text-xs text-gray-500`}
                >
                  By {msg.user}
                </p>
                <div
                  className={`${
                    msg.isUser ? "bg-blue-500" : "bg-gray-200"
                  } p-2 rounded-2xl`}
                >
                  <p
                    className={`text-base font-mono font-semibold max-w-full break-words whitespace-pre-wrap ${
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
      <div className="items-center space-x-2 border-t pt-1 p-4">
        {/* display on mobile  */}
        <UiButton
          className="float-end mb-2"
          text="SEND"
          onClick={sendMessage}
        />
        <UiTextarea
          value={input}
          onChange={(str) => setInput(str)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
        />
      </div>
    </div>
  );
}
