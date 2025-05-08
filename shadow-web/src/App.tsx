import "./App.css";
import {
  createBrowserRouter,
  createRoutesFromElements,
  Route,
  RouterProvider,
  useNavigate,
} from "react-router-dom";
import Room from "./room";
import { useEffect } from "react";
import { v4 as uuidv4 } from "uuid";
import "./socket";
import "./stores/connection-store";

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route>
      <Route index element={<RedirectToNewRoom />} />
      <Route path="/:id" element={<Room />} />
    </Route>,
  ),
);

function RedirectToNewRoom() {
  const navigate = useNavigate();

  useEffect(() => {
    const newRoomId = uuidv4();
    navigate(`/${newRoomId}`, { replace: true });
  }, [navigate]);

  return null; // This component doesn't render anything
}

function App() {
  return <RouterProvider router={router} />;
}

export default App;
