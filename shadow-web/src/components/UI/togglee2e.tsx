import { useState } from "react";
import { store, useE2EE } from "../../stores/connection-store";

export default function ToggleE2EButton() {
  const [isOn, setIsOn] = useState(useE2EE());

  const handleToggle = () => {
    setIsOn(!isOn);
    store.trigger.setE2EE({
      enabled: !isOn,
    });
  };

  return (
    <div className="flex items-center gap-3" onClick={handleToggle}>
      <button
        className={`flex h-6 w-10 items-center rounded-full p-1 transition-colors duration-300 ${
          isOn ? "bg-gray-400" : "bg-gray-500"
        }`}
      >
        <div
          className={`h-4 w-4 transform rounded-full bg-white shadow-md transition-transform duration-300 ${
            isOn ? "translate-x-4" : ""
          }`}
        />
      </button>
      <div className="text-white select-none">
        {isOn ? "Using E2EE" : "Not using E2EE"}
      </div>
    </div>
  );
}
