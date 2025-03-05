"use client";
import { useRef, useState } from "react";
import { UiButton } from "~/components/UI/button";
import { UiChat } from "~/components/UI/chat";
import { UiUserNetwork } from "~/components/UI/userNetwork";

export default function RoomPage() {
  return (
    <div className=" bg-slate-500 h-screen flex relative">
      <UiUserNetwork
        me={{ id: 0, userName: "Me" }}
        users={[
          { id: 1, userName: "user 1" },
          { id: 2, userName: "user 2" },
          { id: 3, userName: "Charli edddddd ddddddd" },
          { id: 4, userName: "David sdd sd" },
          { id: 5, userName: "Cedd ddddddd wdddd" },
          { id: 6, userName: "David sdd sd" },
        ]}
      />
      {window.innerWidth < 1000 ? (
        <MobileChatPanel />
      ) : (
        <div className="py-5 h-screen">
          <UiChat />
        </div>
      )}
    </div>
  );
}

function MobileChatPanel(props: {}) {
  const chatRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(true);

  return (
    <div
      className={` fixed top-1/2 -translate-y-1/2 ease-in-out duration-300 z-50`}
      style={{
        right: isOpen ? "0px" : -(chatRef.current?.clientWidth ?? 0),
      }}
    >
      <UiButton
        text="chat"
        className="absolute top-7 left-0 -translate-x-full rounded-r-none"
        onClick={() => setIsOpen(!isOpen)}
      />
      <div ref={chatRef} className="py-5 h-screen">
        <UiChat />
      </div>
    </div>
  );
}
