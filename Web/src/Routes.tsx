import { BrowserRouter, Routes, Route } from "react-router-dom";
import { SingIn } from "./screens/SingIn/SingIn";
import { Spells } from "./screens/Spells/Spells";
import { GMScreen } from "./screens/GMScreen/GMScreen";
import { Campaing } from "./screens/Campaing/Campaing";
import { Header } from "./components/Header/Header";
// import { useAppSelector } from "./redux/hooks/hooks";
import { SingUp } from "./screens/SingUp/SingUp";
import { Potions } from "./screens/Potions/Potions";
import { MyFile } from "./screens/MyFile/MyFile";

export const AppRoutes = () => {
  // const user = useAppSelector((state) => state.authReducer.user);

  return (
    <BrowserRouter>
      {/* {user ? <Header />: null} */}
      <Header/>
      <Routes>
        <Route path="/" element={<SingIn />} />
        <Route path="/singup" element={<SingUp />} />
        <Route path="/campaing" element={<Campaing />} />
        <Route path="/almanac" element={<Spells />} />
        <Route path="/playerfiles" element={<GMScreen />} />
        <Route path="/myfile" element={<MyFile />} />
        <Route path="/potions" element={<Potions />} />
      </Routes>
    </BrowserRouter>
  );
};
