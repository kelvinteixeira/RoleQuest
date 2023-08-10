import { Grid, Typography, Avatar, Button, IconButton } from "@mui/material";

import { useAppSelector } from "../../redux/hooks/hooks";
import { useNavigate } from "react-router-dom";

import { StyledContainer, StyledTypography } from "./Header.styles";

export const Header = () => {
  const user = useAppSelector((state) => state.authReducer.user);
  const navigate = useNavigate();

  return (
    <StyledContainer>
      <Grid container justifyContent={"space-around"} alignItems={"center"}>
        <Button onClick={() => navigate("/campaing")}>
          <StyledTypography>Campanha</StyledTypography>
        </Button>
        <Button onClick={() => navigate("/almanac")}>
          <StyledTypography>Almanaque</StyledTypography>
        </Button>
        <Button onClick={() => navigate("/playerfiles")}>
          <StyledTypography>Fichas</StyledTypography>
        </Button>
      </Grid>

      <Grid
        container
        justifyContent={"flex-end"}
        alignItems={"center"}
        marginRight={2}
      >
        <Typography
          marginRight={1}
          sx={{
            color: "white",
            fontSize: 30,
            fontFamily: "HarryPotter !important",
          }}
        >
          Bem vindo {user?.name}
        </Typography>
        <IconButton>
          <Avatar alt="picture user" src={user?.picture} />
        </IconButton>
      </Grid>
    </StyledContainer>
  );
};
