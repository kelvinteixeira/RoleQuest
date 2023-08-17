import { styled, Box, Typography, TableCell } from "@mui/material";

export const StyledBox = styled(Box)`
  width: 45vw;
  margin-top: 2rem;
  max-height: 75vh;
  padding: 1rem;
  background: rgba(90, 86, 60, 0.1);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(15px);
  box-shadow: 0 8px 32px 0 #352622;
  overflow: scroll;
`;

export const StyledTitle = styled(Typography)`
  font-family: "HarryPotter" !important;
  color: #fff;
  font-size: 4rem;
  -webkit-text-stroke-width: 2px;
  -webkit-text-stroke-color: #000;
`;
export const StyledTopic = styled(Typography)`
  font-family: "HarryPotter" !important;
  color: #fff;
  font-size: 2rem;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: #000;
`;

export const StyledParagraphy = styled(Typography)`
  color: #fff;
  font-size: 0.8rem;
`;

export const StyledTableCell = styled(TableCell)`
  color: #fff;
  font-size: 1rem;
`;

export const StyledTableItem = styled(TableCell)`
  font-size: 0.9rem;
  color: #fff;
`;
