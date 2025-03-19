import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { store, useClientId, useClients } from "./stores/connection-store";
import { useRef, useState } from "react";
import { UiChat } from "./components/UI/chat";
import { UiUserNetwork } from "./components/UI/userNetwork";
import { button } from "./components/UI/button";
import ShareButton from "./components/UI/share";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments } from "@fortawesome/free-solid-svg-icons";

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

  const makeConnection = (id: string) => {
    store.send({ type: "setTarget", targetId: id });
  };

  return (
    <div className="relative flex h-screen w-full bg-slate-500">
      <UiUserNetwork
        me={{ id: 0, userName: client }}
        users={clients.map((client: any, index) => {
          return { id: index + 1, userName: client.clientId };
        })}
        onClick={makeConnection}
      />

      {window.innerWidth < 1000 ? (
        <MobileChatPanel />
      ) : (
        <div className="h-screen py-5">
          <UiChat />
        </div>
      )}
      <div className="absolute bottom-4 left-4">
        <ShareButton />
      </div>
    </div>
  );
}

export default Room;

function MobileChatPanel() {
  const chatRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div
      className={`fixed top-1/2 z-50 -translate-y-1/2 duration-300 ease-in-out`}
      style={{
        right: isOpen ? "0px" : -(chatRef.current?.clientWidth ?? 0),
      }}
    >
      <button
        onClick={()=>setIsOpen(!isOpen)}
        className={button({
          size: "sm",
          color: "primary",
          padding: "none",
          className:
            "absolute top-7 left-0 -translate-x-full rounded-r-none p-2",
        })}
      >
        <FontAwesomeIcon icon={faComments} />
      </button>
      <div ref={chatRef} className="h-screen py-5">
        <UiChat />
      </div>
    </div>
  );
}
