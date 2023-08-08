import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import { useAppSelector } from "../../redux/hooks/hooks";
import { Box, Grid, styled } from "@mui/material";
import { useNavigate } from "react-router-dom";

export const Header = () => {
  const user = useAppSelector((state) => state.authReducer.user);
  const navigate = useNavigate();

  return (
    <StyledContainer>
      <Grid container justifyContent={"space-around"} alignItems={"center"}>
        <Button
          sx={{
            color: "white",
            fontSize: 30,
            fontFamily: "HarryPotter !important",
          }}
          onClick={() => navigate("/campaing")}
        >
          Campanha
        </Button>
        <Button
          sx={{
            color: "white",
            fontSize: 30,
            fontFamily: "HarryPotter !important",
          }}
          onClick={() => navigate("/almanac")}
        >
          Almanaque
        </Button>
        <Button
          sx={{
            color: "white",
            fontSize: 30,
            fontFamily: "HarryPotter !important",
          }}
          onClick={() => navigate("/playerfiles")}
        >
          Fichas
        </Button>
      </Grid>

      <Grid container justifyContent={"flex-end"} alignItems={"center"} marginRight={2}>
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

const StyledContainer = styled(Box)`
  display: flex;
  flex-direction: row;
  margin-top: 3rem;
`;
