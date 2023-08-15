import { styled, Box, Typography, TableCell } from "@mui/material";

export const StyledBox = styled(Box)`
  width: 90vw;
  margin-top: 2rem;
  max-height: 75vh;
  padding: 2rem;
  background: rgba(90, 86, 60, 0.1);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(5px);
  box-shadow: 0 8px 32px 0 #352622;
  overflow: scroll;
`;

export const StyledTitle = styled(Typography)`
  font-family: "HarryPotter" !important;
  color: black;
  font-size: 4rem;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: #fff;
`;

export const StyledTableCell = styled(TableCell)`
  font-family: "HarryPotter" !important;
  color: black;
  font-size: 3rem;
  -webkit-text-stroke-width: .5px;
  -webkit-text-stroke-color: #fff;
`;

export const StyledTableItem = styled(TableCell)`
  color: black;
  font-size: .9rem;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: #fff;
`;