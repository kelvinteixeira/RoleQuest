import { styled, Box, Typography } from "@mui/material";

export const StyledBox = styled(Box)`
  width: 90vw;
  margin-top: 2rem;
  max-height: 75vh;
  padding: 2rem;
  background: rgba(90, 86, 60, 0.1);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(5px);
  box-shadow: 0 8px 32px 0 #8d550b5e;
  overflow: scroll;
`;

export const StyledTitle = styled(Typography)`
  font-family: "HarryPotter" !important;
  color: #e08f14;
  font-size: 5rem;
  -webkit-text-stroke-width: 2px;
  -webkit-text-stroke-color: #000;
`;
export const StyledTopic = styled(Typography)`
  font-family: "HarryPotter" !important;
  color: #000;
  font-size: 3rem;
  -webkit-text-stroke-width: 1px;
  -webkit-text-stroke-color: #e08f14;
`;

export const StyledParagraphy = styled(Typography)`
  font-family: "HarryPotter" !important;
  color: #fff;
  font-size: 2rem;
  -webkit-text-stroke-width: 0.3px;
  -webkit-text-stroke-color: #e08f14;
`;
