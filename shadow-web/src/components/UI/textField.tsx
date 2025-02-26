export function UiTextField(props: {
	value: string;
	placeholder?: string;
	onChange: (str: string) => void;
}) {
	return (
		<input
			type="text"
			value={props.value}
			onChange={(e) => props.onChange(e.target.value)}
			className="flex-1 p-2 border rounded-lg"
			placeholder={props.placeholder}
		/>
	);
}
