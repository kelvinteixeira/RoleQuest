import { Grid } from "@mui/material";

import backgroundVideo from "../../assets/videos/backgroundAlmanac.mp4";

import { StyledBox } from "./Spells.styles";
import { CharmsTable } from "./SpellsTable/CharmsTable";
import { HexesTable } from "./SpellsTable/HexesTable";
import { CursesTable } from "./SpellsTable/CursesTable";

export const Spells = () => {
  return (
    <Grid container justifyContent={'center'}>
      <video autoPlay muted loop>
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      <StyledBox className="scroll-hidden">
        <CharmsTable />
        <HexesTable />
        <CursesTable />
      </StyledBox>
    </Grid>
  );
};
