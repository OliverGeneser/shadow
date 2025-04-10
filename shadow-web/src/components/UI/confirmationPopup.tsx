export default function ConfirmationPopup(props:{
  username: string;
  onAccept: () => void;
  onDecline: () => void;
  isOpen: boolean;
}) {
  if (!props.isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center">
      <div className="fixed inset-0 transition-opacity">
        <div className="absolute inset-0 bg-gray-500 opacity-75"></div>
      </div>
      <div className="bg-gray-700 p-6 rounded-2xl shadow-xl w-80 z-50 text-center">
        <p className="text-lg font-semibold mb-4 text-white">
          <span className="text-blue-600">{props.username}</span> wants to send you a file
        </p>
        <div className="flex justify-center gap-4">
          <button
            onClick={props.onAccept}
            className="px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition cursor-pointer"
          >
            Accept
          </button>
          <button
            onClick={props.onDecline}
            className="px-4 py-2 bg-red-500 text-white rounded-xl hover:bg-red-600 transition cursor-pointer"
          >
            Decline
          </button>
        </div>
      </div>
    </div>
  );
};
