import { Card, Typography, Grid, Button } from "@mui/material";
import GoogleIcon from "@mui/icons-material/Google";
import { useState } from "react";
import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { auth } from "../../services/firebase";
import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";
import { setLogin } from "../../redux/auth/authSlice";

export const Login = () => {
  const [user, setUser] = useState<User>({} as User);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();

    signInWithPopup(auth, provider)
      .then((result) => {
        setUser(result.user);
        dispatch(
          setLogin({
            name: result.user.displayName!,
            picture: result.user.photoURL!,
            email: result.user.email!
          })
        );
        navigate("/home");
      })
      .catch((error) => {
        console.log(error);
      });
  }
  return (
    <Grid
      container
      justifyContent={"center"}
      sx={{ height: "100vh" }}
      alignItems={"center"}
    >
      <Card sx={{ width: 300, padding: 2, backgroundColor: "#ffffff80" }}>
        <Typography variant="body1" align="center" fontWeight={"bold"}>
          Acesse sua conta
        </Typography>
        <Typography
          paddingBottom={1}
          variant="body2"
          align="center"
          fontWeight={"bold"}
          color={"#00000090"}
        >
          Autencicação com o Google você facilita sua vida sem precisar fazer
          cadastro.
        </Typography>
        <Grid container justifyContent={"center"}>
          <Button
            onClick={handleGoogleLogin}
            startIcon={<GoogleIcon />}
            variant="contained"
            color="inherit"
          >
            Entrar com google
          </Button>
        </Grid>
      </Card>
    </Grid>
  );
};
