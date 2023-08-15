import { useState, useEffect } from "react";

import {
  Grid,
  Table,
  TableBody,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import backgroundVideo from "../../assets/videos/backgroundPotions.mp4";
import { api } from "../../lib/axios";

import {
  StyledBox,
  StyledTitle,
  StyledTableCell,
  StyledTableItem,
} from "./Potions.styles";

type PotionsProps = {
  name: string;
  ingredients: string;
  effect: string;
  price: string;
};

const tableheader = ["Nome", "Ingredientes", "Efeito", "Preço"];

export const Potions = () => {
  const [potions, setPotions] = useState([]);

  useEffect(() => {
    api.get("/potions").then((response) => setPotions(response.data));
  }, []);
  return (
    <Grid container justifyContent={"center"}>
      <video autoPlay muted loop>
        <source src={backgroundVideo} type="video/mp4" />
      </video>
      <StyledBox className="scroll-hidden">
        <StyledTitle textAlign={"center"}>Poções</StyledTitle>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                {tableheader.map((header, index) => (
                  <StyledTableCell key={index}>{header}</StyledTableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {potions.map((potion: PotionsProps) => (
                <TableRow key={potion.name}>
                  <StyledTableItem>{potion.name}</StyledTableItem>
                  <StyledTableItem>{potion.ingredients}</StyledTableItem>
                  <StyledTableItem>{potion.effect}</StyledTableItem>
                  <StyledTableItem>{potion.price} Galeões</StyledTableItem>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </StyledBox>
    </Grid>
  );
};
