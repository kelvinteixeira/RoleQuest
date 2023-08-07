import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Login } from "./screens/Login/Login";
import { Almanac } from "./components/Almanac/Almanac";
import { PlayerFiles } from "./components/PlayerFiles/PlayerFiles";
import { Campaing } from "./components/Campaing/Campaing";
import { Header } from "./components/Header/Header";
import { useAppSelector } from "./redux/hooks/hooks";

export const AppRoutes = () => {
  const user = useAppSelector((state) => state.authReducer.user);

  return (
    <BrowserRouter>
      {user ? <Header />: null}
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/campaing" element={<Campaing />} />
        <Route path="/almanac" element={<Almanac />} />
        <Route path="/playerFiles" element={<PlayerFiles />} />
      </Routes>
    </BrowserRouter>
  );
};
