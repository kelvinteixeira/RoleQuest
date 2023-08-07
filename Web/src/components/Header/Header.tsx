import AppBar from "@mui/material/AppBar";
import Box from "@mui/material/Box";
import Toolbar from "@mui/material/Toolbar";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Menu from "@mui/material/Menu";
import MenuIcon from "@mui/icons-material/Menu";
import CasinoIcon from "@mui/icons-material/Casino";
import Container from "@mui/material/Container";
import Avatar from "@mui/material/Avatar";
import Button from "@mui/material/Button";
import MenuItem from "@mui/material/MenuItem";
import { useAppSelector } from "../../redux/hooks/hooks";
import { Grid } from "@mui/material";
import { useNavigate } from "react-router-dom";

const pages = ["Campanha", "Almanaque", "Fichas"];
const settings = ["Profile", "Account", "Dashboard", "Logout"];

export const Header = () => {
  const user = useAppSelector((state) => state.authReducer.user);
  const navigate = useNavigate()

  return (
    <AppBar position="static" color="default">
      <Container maxWidth="xl">
        <Toolbar disableGutters>
          <CasinoIcon sx={{ display: { xs: "none", md: "flex" }, mr: 1 }} />
          <Typography
            variant="h6"
            noWrap
            component="a"
            sx={{
              mr: 2,
              display: { xs: "none", md: "flex" },
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            RoleQuest
          </Typography>

          <Box sx={{ flexGrow: 1, display: { xs: "flex", md: "none" } }}>
            <IconButton
              size="large"
              aria-label="account of current user"
              aria-controls="menu-appbar"
              aria-haspopup="true"
              color="inherit"
            >
              <MenuIcon />
            </IconButton>
            <Menu
              id="menu-appbar"
              anchorOrigin={{
                vertical: "bottom",
                horizontal: "left",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "left",
              }}
              sx={{
                display: { xs: "block", md: "none" },
              }}
              open={false}
            >
              {pages.map((page) => (
                <MenuItem key={page}>
                  <Typography textAlign="center">{page}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
          <CasinoIcon sx={{ display: { xs: "flex", md: "none" }, mr: 1 }} />
          <Typography
            variant="h5"
            noWrap
            component="a"
            href=""
            sx={{
              mr: 2,
              display: { xs: "flex", md: "none" },
              flexGrow: 1,
              fontFamily: "monospace",
              fontWeight: 700,
              letterSpacing: ".3rem",
              color: "inherit",
              textDecoration: "none",
            }}
          >
            LOGO
          </Typography>
          <Box sx={{ flexGrow: 1, display: { xs: "none", md: "flex" } }}>
              <Button
                sx={{
                  my: 3,
                  color: "black",
                  display: "block",
                  textTransform: "none",
                }}
                onClick={() => navigate('/campaing')}
              >
                Campanha
              </Button>
              <Button
                sx={{
                  my: 3,
                  color: "black",
                  display: "block",
                  textTransform: "none",
                }}
                onClick={() => navigate('/almanac')}

              >
                Almanaque
              </Button>
              <Button
                sx={{
                  my: 3,
                  color: "black",
                  display: "block",
                  textTransform: "none",
                }}
                onClick={() => navigate('/playerFiles')}

              >
                Fichas
              </Button>
          </Box>

          <Box sx={{ flexGrow: 0 }}>
            <Grid container justifyContent={"center"} alignItems={'center'}>
              <Typography marginRight={1}>
                Bem vindo <strong>{user?.name}</strong>
              </Typography>
              <IconButton sx={{ p: 0 }}>
                <Avatar alt="Remy Sharp" src={user?.picture} />
              </IconButton>
            </Grid>
            <Menu
              sx={{ mt: "45px" }}
              id="menu-appbar"
              anchorOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              keepMounted
              transformOrigin={{
                vertical: "top",
                horizontal: "right",
              }}
              open={false}
            >
              {settings.map((setting) => (
                <MenuItem key={setting}>
                  <Typography textAlign="center">{setting}</Typography>
                </MenuItem>
              ))}
            </Menu>
          </Box>
        </Toolbar>
      </Container>
    </AppBar>
  );
};
