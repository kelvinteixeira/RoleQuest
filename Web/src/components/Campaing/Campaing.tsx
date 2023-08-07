import { Box, Container, Typography } from "@mui/material";
import { api } from "../../lib/axios";
import { useState, useEffect } from "react";

type CampaingProps = {
  title: string
  ambient: string
  description: string
}

export const Campaing = () => {
  const [campaings, setCampaings] = useState([]);

  useEffect(() => {
    api.get("/campaings").then((response) => setCampaings(response.data));
  }, []);

  console.log(campaings);

  return (
    <Container>
      {campaings.map((campaing : CampaingProps) => (
        <Box
          sx={{
            width: "100%",
            height: 480,
            marginTop: 3,
            background: "#000000",
            borderRadius: 6,
          }}
        >
          <Typography
            variant="body1"
            padding={1}
            textAlign={"center"}
            sx={{ color: "white", fontSize: 60 }}
          >
            {campaing.title}
          </Typography>

          <Typography
            variant="body1"
            padding={3}
            sx={{ color: "white", fontSize: 30 }}
          >
            Ambientação: <Typography sx={{color: 'red', fontSize: 20}}> {campaing.ambient}</Typography>
          </Typography>
          <Typography
            variant="body1"
            padding={3}
            sx={{ color: "white", fontSize: 30 }}
          >
            Sinopse: <Typography sx={{color: 'red', fontSize: 20}}> {campaing.description}</Typography>
          </Typography>
        </Box>
      ))}
    </Container>
  );
};
