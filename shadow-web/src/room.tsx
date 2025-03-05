import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import {
  store,
  useClientId,
  useClients,
  useRoomId,
} from "./stores/connection-store";
import { useRef, useState } from "react";
import { UiChat } from "./components/UI/chat";
import { UiUserNetwork } from "./components/UI/userNetwork";
import { UiButton } from "./components/UI/button";

function Room() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useClientId();
  const clients = useClients();

  useEffect(() => {
    if (!uuidValidate(id)) {
      const newRoomId = uuidv4();
      navigate(`/${newRoomId}`, { replace: true });
      return;
    }
    store.send({ type: "setupSocket", roomId: id });
    store.send({ type: "setupConnection" });
  }, [id, navigate]);

  const sendMessageE = () => {
    store.trigger.sendMessage({ message: { type: "clients" } });
  };

  const makeConnection = (id: string) => {
    console.log(id);
  };

  return (
    <div className="w-full bg-slate-500 h-screen flex relative">
      <UiUserNetwork
        me={{ id: 0, userName: client }}
        users={clients.map((client: any, index) => {
          return { id: index + 1, userName: client.clientId };
        })}
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

export default Room;

function MobileChatPanel() {
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
