export function UiTextarea(props: {
	value: string;
	placeholder?: string;
	onChange: (str: string) => void;
	onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}) {
	return (
		<textarea
			value={props.value}
			onChange={(e) => props.onChange(e.target.value)}
			onKeyDown={props.onKeyDown}
			className="flex-1 w-full p-2 border rounded-lg text-gray-600 break-words h-20 resize-none overflow-y-auto"
			placeholder={props.placeholder}
		/>
	);
}
