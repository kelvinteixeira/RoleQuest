import { useAppSelector } from "../../redux/hooks/hooks";

export const Home = () => {
  const user = useAppSelector((state) => state.authReducer.user);
  return (
    <>
      <h1>Hello Home</h1>
      <h1>{user!.name}</h1>
      <img src={user!.picture} alt="Imagem do cliente logado" />
    </>
  );
};
