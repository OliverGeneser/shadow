type Message = {
	id: number;
	user: string;
	text: string;
};

export default function UiChatComponent() {
	return (
		<div className="max-w-md mx-auto p-4 border rounded-lg shadow-lg bg-gray-50">
			chat
		</div>
	);
}
