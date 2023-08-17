import { Grid } from "@mui/material";

import backgroundImage from "../../assets/images/backgroundPlayerfiles.png";
import { PlayerCard } from "../../components/PlayerCard/PlayerCard";

export const GMScreen = () => {
  return (
    <Grid container justifyContent={"center"} alignItems={"center"}>
      <img
        style={{
          objectFit: "cover",
          position: "absolute",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          zIndex: -1,
        }}
        src={backgroundImage}
      />
      <Grid container justifyContent={"space-around"}>
        <PlayerCard />
      </Grid>
    </Grid>
  );
};
