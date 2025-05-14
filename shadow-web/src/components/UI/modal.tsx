export default function Modal(props: {
  text: string;
  isOpen: boolean;
  children: React.ReactNode;
}) {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="fixed inset-0 transition-opacity">
        <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
      </div>
      <div className="z-50 w-[600px] rounded-2xl bg-gray-700 p-6 text-center shadow-xl">
        <p className="mb-4 text-lg font-semibold text-white">{props.text}</p>
        <div className="flex justify-center gap-4">{props.children}</div>
      </div>
    </div>
  );
}
