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
		<div className="w-96 mx-auto border rounded-lg shadow-lg bg-gray-50 h-full flex flex-col">
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
								<p
									className={`text-lg font-mono font-semibold max-w-full break-words ${
										msg.isUser ? "text-right text-blue-500" : "text-gray-600"
									}`}
								>
									{msg.text}
								</p>
							</div>
						</div>
					))}
					<div ref={messagesEndRef} />
				</div>
			</div>
			<div className="items-center space-x-2 border-t pt-1 p-4">
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
