import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { v4 as uuidv4, validate as uuidValidate } from "uuid";
import { store, useClientId, useClients } from "./stores/connection-store";
import { UiChat } from "./components/UI/chat";
import { UiUserNetwork } from "./components/UI/userNetwork";
import { button } from "./components/UI/button";
import ShareButton from "./components/UI/share";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faComments } from "@fortawesome/free-solid-svg-icons";

function RoomView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = useClientId();
  const clients = useClients();

  useEffect(() => {
    if (!uuidValidate(id) || id === undefined) {
      const newRoomId = uuidv4();
      navigate(`/${newRoomId}`, { replace: true });
      return;
    } else {
      store.send({ type: "setRoom", roomId: id });
    }
  }, [id, navigate]);

  const makeConnection = (id: string) => {
    store.send({ type: "setupConnection", peerId: id });
  };

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-gray-600">
      <div className="absolute inset-0 w-screen origin-bottom-left -rotate-12 transform bg-gradient-to-br from-gray-700 to-gray-600" />

      <UiUserNetwork
        me={{ id: 0, userName: client }}
        users={clients.map((client: any, index) => {
          return { id: index + 1, userName: client.clientId };
        })}
        onClick={makeConnection}
      />

      <ChatPanel open={window.innerWidth > 1000} />

      <div className="absolute bottom-4 left-4">
        <ShareButton />
      </div>
    </div>
  );
}

export default RoomView;

function ChatPanel(props: { open: boolean }) {
  const chatRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(props.open);
  const [chatWidth, setChatWidth] = useState(1000);

  useEffect(()=>{
    chatRef.current?.clientWidth&&setChatWidth(chatRef.current?.clientWidth)
  },[chatRef.current?.clientWidth]);

  return (
    <div
      className={`fixed top-1/2 z-50 -translate-y-1/2 duration-300 ease-in-out`}
      style={{
        right: isOpen ? "0px" : -chatWidth,
      }}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={button({
          size: "sm",
          color: "primary",
          padding: "none",
          className:
            "absolute top-20 left-0 -translate-x-full rounded-r-none bg-gray-500 p-2 hover:bg-gray-400",
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
