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
      className="h-20 w-full flex-1 resize-none overflow-y-auto rounded-lg border border-gray-300 p-2 break-words text-gray-600"
      placeholder={props.placeholder}
    />
  );
}
