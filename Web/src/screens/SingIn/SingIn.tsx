import { useState } from "react";

import {
  Typography,
  Button,
  InputLabel,
  FormControl,
  InputAdornment,
  IconButton,
  Input,
  Link,
  createTheme,
  ThemeProvider,
} from "@mui/material";

import { GoogleAuthProvider, signInWithPopup, User } from "firebase/auth";
import { auth } from "../../services/firebase";
import { setLogin } from "../../redux/auth/authSlice";

import { useNavigate } from "react-router-dom";
import { useDispatch } from "react-redux";

import backgroundVideo from "../../assets/videos/backgroundSingIn.mp4";
import logoImage from "../../assets/images/logo.png";

import VisibilityOff from "@mui/icons-material/VisibilityOff";
import Visibility from "@mui/icons-material/Visibility";
import GoogleIcon from "@mui/icons-material/Google";

import { grey } from "@mui/material/colors";

import { StyledGrid, StyledCard } from "./SingIn.styles";

const theme = createTheme({
  palette: {
    primary: grey,
  },
});

export const SingIn = () => {
  const [user, setUser] = useState<User>({} as User);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const [showPassword, setShowPassword] = useState(false);

  const handleClickShowPassword = () => setShowPassword((show) => !show);

  const handleMouseDownPassword = (
    event: React.MouseEvent<HTMLButtonElement>
  ) => {
    event.preventDefault();
  };

  function handleGoogleLogin() {
    const provider = new GoogleAuthProvider();

    signInWithPopup(auth, provider)
      .then((result) => {
        setUser(result.user);
        dispatch(
          setLogin({
            name: user.displayName!,
            picture: user.photoURL!,
            email: user.email!,
          })
        );
        navigate("/campaing");
      })
      .catch((error) => {
        console.log(error);
      });
  }
  return (
    <ThemeProvider theme={theme}>
      <video autoPlay muted loop>
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      <StyledGrid
        container
        justifyContent={"space-around"}
        alignItems={"center"}
        className="custom-font"
      >
        <img
          className="removed-background"
          src={logoImage}
          style={{ height: 170 }}
        />
        <StyledCard>
          <Typography
            fontWeight={"bold"}
            fontSize={20}
            align="center"
            color={"white"}
            sx={{ fontFamily: "HarryPotter" }}
          >
            Acesse sua conta
          </Typography>

          <FormControl
            color={"primary"}
            variant="standard"
            sx={{ marginBottom: 1 }}
          >
            <InputLabel focused htmlFor="email">
              <Typography fontWeight={"bold"}>Email</Typography>
            </InputLabel>
            <Input id="email" sx={{ color: "white" }} />
          </FormControl>

          <FormControl variant="standard" color="primary">
            <InputLabel focused htmlFor="password" color="primary">
              <Typography fontWeight={"bold"}>Senha</Typography>
            </InputLabel>
            <Input
              sx={{ color: "white" }}
              id="password"
              type={showPassword ? "text" : "password"}
              endAdornment={
                <InputAdornment position="end" sx={{ color: "white" }}>
                  <IconButton
                    sx={{ color: "white" }}
                    aria-label="toggle password visibility"
                    onClick={handleClickShowPassword}
                    onMouseDown={handleMouseDownPassword}
                  >
                    {showPassword ? (
                      <VisibilityOff sx={{ height: 14 }} />
                    ) : (
                      <Visibility sx={{ height: 14 }} />
                    )}
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
          <Typography fontWeight={"bold"} fontSize={12} marginBottom={2}>
            <Link sx={{ color: "white", cursor: "pointer" }}>
              esqueceu a senha?
            </Link>
          </Typography>
          <Button
            variant="contained"
            color="inherit"
            sx={{ textTransform: "none", marginBottom: 1 }}
          >
            Entrar
          </Button>

          <Typography
            fontWeight={"bold"}
            textAlign={"center"}
            fontSize={12}
            sx={{ color: "white", marginBottom: 1 }}
          >
            ou
          </Typography>
          <Typography
            fontSize={14}
            paddingBottom={1}
            align="center"
            color={"white"}
            fontWeight={"bold"}
          >
            Logar com o Google
          </Typography>
          <Button
            onClick={handleGoogleLogin}
            startIcon={<GoogleIcon />}
            variant="contained"
            color="inherit"
            sx={{ textTransform: "none", marginBottom: 1 }}
          >
            Entrar com google
          </Button>
          <Typography
            fontWeight={"bold"}
            textAlign={"center"}
            fontSize={12}
            sx={{ color: "white", marginBottom: 1 }}
          >
            Não poussui conta,{" "}
            <Link
              href="/singup"
              fontSize={"bold"}
              color={"secondary"}
              sx={{ cursor: "pointer" }}
            >
              Clique aqui
            </Link>
          </Typography>
        </StyledCard>
      </StyledGrid>
    </ThemeProvider>
  );
};
