export default function Popup(props:{
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
      <div className="bg-gray-700 p-6 rounded-2xl shadow-xl w-80 z-50 text-center">
        <p className="text-lg font-semibold mb-4 text-white">
          {props.text}
        </p>
        <div className="flex justify-center gap-4">
          {props.children}
        </div>
      </div>
    </div>
  );
};
