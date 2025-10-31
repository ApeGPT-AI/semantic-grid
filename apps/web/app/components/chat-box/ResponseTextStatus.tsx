import { ArrowRight } from "@mui/icons-material";
import type { StepIconProps } from "@mui/material";
import { Stack, Step, StepLabel, Typography } from "@mui/material";
import { keyframes, styled } from "@mui/material/styles";
import React from "react";

// Define the keyframes for pulsing opacity
const pulse = keyframes`
  0% { opacity: 1; }
  50% { opacity: 0.1; }
  100% { opacity: 1; }
`;

// Styled Typography with pulsing animation
const PulsingText = styled(Typography)(({ theme }) => ({
  color: theme.palette.grey[500],
  animation: `${pulse} 1.5s ease-in-out infinite`,
}));

const Status: Record<string, string> = {
  New: "Starting...",
  Intent: "Analyzing intent...",
  SQL: "Generating query...",
  Retry: "Refining response...",
  DataFetch: "Fetching data...",
  Finalizing: "Finalizing...",
  Cancelled: "Cancelled",
  Error: "Error",
};

const RequestStages = ["Intent", "SQL", "Finalizing"];

const CustomStepIcon = (props: StepIconProps) => (
  <ArrowRight sx={{ fontSize: "small", ml: "5px" }} />
);

export const ResponseTextStatus = ({
  status,
  rowCount,
  linkedSession,
  isLoading = false,
  lastMessage = false,
}: {
  status?: string;
  rowCount?: number;
  isLoading?: boolean;
  lastMessage?: boolean;
  linkedSession?: string; // whether to show the link icon
}) => {
  if (
    lastMessage &&
    (status === "Cancelled" || status === "Error" || status === "Done")
  ) {
    /*
    if (status === "Done" && (rowCount || 0) === 0 && !isLoading) {
      return (
        <Typography variant="body2" color="textSecondary">
          (No data returned)
        </Typography>
      );
    }
     */
    return Status[status] ? (
      <Typography variant="body1">{Status[status]}</Typography>
    ) : null;
  }

  if (lastMessage && status && RequestStages.includes(status)) {
    const currentStage = RequestStages.indexOf(status);
    return (
      <Stack direction="row" alignItems="center">
        {RequestStages.map((s, idx) => (
          <Step key={s} completed={s === status}>
            <StepLabel
              sx={{
                "& .MuiStepLabel-iconContainer": {
                  display: idx === 0 ? "none" : "flex", // hide icon container if no icon
                },
                "& span": { ml: 0, pl: 0 },
              }}
              StepIconComponent={idx === 0 ? () => null : CustomStepIcon}
            >
              {s !== status && idx < currentStage && (
                <Typography variant="body2">{s}</Typography>
              )}
              {s !== status && idx > currentStage && (
                <Typography variant="body2" color="darkgrey">
                  {s}
                </Typography>
              )}
              {s === status && <PulsingText variant="body2">{s}</PulsingText>}
            </StepLabel>
          </Step>
        ))}
      </Stack>
    );
    // return <PulsingText variant="body2">{Status[status]}</PulsingText>;
  }
  if (status === "Error") {
    return (
      <Typography variant="body1" color="warning">
        Error
      </Typography>
    );
  }
  if (status) return null;
  return null;
};
