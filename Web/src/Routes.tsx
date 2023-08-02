import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Login } from "./screens/Login/Login";
import { Home } from "./screens/Home/Home";

export const AppRoutes = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </BrowserRouter>
  );
};
