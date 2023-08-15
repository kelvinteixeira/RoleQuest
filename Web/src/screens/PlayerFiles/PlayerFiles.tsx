import { Box, styled } from "@mui/material";

import backgroundImage from "../../assets/images/backgroundPlayerfiles.png";

export const PlayerFiles = () => {
  return (
    <StyledBox>
      <img style={{ objectFit: "cover" }} src={backgroundImage} />
    </StyledBox>
  );
};

const StyledBox = styled(Box)`
  img {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    z-index: -1;
  }
`;
