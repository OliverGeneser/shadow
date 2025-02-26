export function UiButton(props: { text: string; onClick: () => void }) {
	return (
		<button
			onClick={props.onClick}
			className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
		>
			{props.text}
		</button>
	);
}
