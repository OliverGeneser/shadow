import "./App.css";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import RoomView from "./components/view/room-view";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import "./socket";
import "./store";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route index element={<RedirectToNewRoom />} />
      <Route path="/:id" element={<RoomView />} />
    </Route>,
  ),
);

function RedirectToNewRoom() {
  const navigate = useNavigate();

  useEffect(() => {
    const newRoomId = uuidv4();
    navigate(`/${newRoomId}`, { replace: true });
  }, [navigate]);

  return null;
}

function App() {
  const handleCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    alert("Copying is disabled");
  };

  const handleRightClick = (e: MouseEvent) => {
    e.preventDefault();
    alert("Right-click is disabled");
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "PrintScreen") {
      event.preventDefault();
      alert("Print Screen is disabled.");
    }
  };

  useEffect(() => {
    document.addEventListener("copy", handleCopy);
    document.addEventListener("contextmenu", handleRightClick);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("copy", handleCopy);
      document.removeEventListener("contextmenu", handleRightClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return <RouterProvider router={router} />;
}

export default App;
