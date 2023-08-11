import { Card, Grid, styled } from "@mui/material";

export const StyledGrid = styled(Grid)`
  height: 100vh;
  width: 100vw;
  background-size: cover;
`;

export const StyledCard = styled(Card)`
  display: flex;
  flex-direction: column;
  width: 25rem;
  padding: 2rem;

  background: rgba(68, 64, 99, 0.1);
  -webkit-backdrop-filter: blur(15px);
  backdrop-filter: blur(5px);
  box-shadow: 0 8px 32px 0 #7171995e;
`;
