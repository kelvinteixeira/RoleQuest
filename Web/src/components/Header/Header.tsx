import {
  Grid,
  Typography,
  Avatar,
  Button,
  IconButton,
  Box,
} from "@mui/material";

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
        <Button onClick={() => navigate("/playerfiles")}>
          <StyledTypography>Tela do mestre</StyledTypography>
        </Button>
        <Button onClick={() => navigate("/almanac")}>
          <StyledTypography>Feitiços</StyledTypography>
        </Button>
        <Button onClick={() => navigate("/potions")}>
          <StyledTypography>Poções</StyledTypography>
        </Button>
        <Button onClick={() => navigate("/myfile")}>
          <StyledTypography>Ficha</StyledTypography>
        </Button>

        <Box sx={{ display: "flex" }}>
          <IconButton>
            <Avatar alt="picture user" src={user?.picture} />
          </IconButton>
        </Box>
      </Grid>
    </StyledContainer>
  );
};
