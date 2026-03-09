import React from "react";
import { Box, Typography, alpha, useTheme } from "@mui/material";
import Card from "./Card";

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  intent?: "default" | "success" | "warning" | "danger" | "info";
}

export default function StatCard({
  icon,
  label,
  value,
  trend,
  trendValue,
  intent = "default",
}: StatCardProps) {
  const theme = useTheme();

  const trendColor = {
    up: "success.main",
    down: "error.main",
    neutral: "text.secondary",
  };

  const intentKey: Record<
    NonNullable<StatCardProps["intent"]>,
    "primary" | "success" | "warning" | "error" | "info"
  > = {
    default: "primary",
    success: "success",
    warning: "warning",
    danger: "error",
    info: "info",
  };

  const colorKey = intentKey[intent];

  return (
    <Card
      hoverable
      sx={{
        p: 2.5,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: 2
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <Box
          sx={{
            p: 1.25,
            borderRadius: 'var(--radius-m3-md, 12px)',
            bgcolor: (theme) => alpha(theme.palette[colorKey].main, 0.12),
            color: (theme) => theme.palette[colorKey].main,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: (theme) => `0 2px 8px ${alpha(theme.palette[colorKey].main, 0.08)}`
          }}
        >
          {React.isValidElement(icon)
            ? React.cloneElement(icon as React.ReactElement, { fontSize: "small" })
            : <Box component="span" sx={{ fontSize: '1.25rem', lineHeight: 1 }}>{icon}</Box>}
        </Box>

        {trend && trendValue && (
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              px: 1,
              py: 0.5,
              borderRadius: '100px',
              bgcolor: (theme) => 
                trend === 'up' ? alpha(theme.palette.success.main, 0.1) :
                trend === 'down' ? alpha(theme.palette.error.main, 0.1) :
                alpha(theme.palette.action.active, 0.04),
              color: trendColor[trend],
            }}
          >
            <Typography
              variant="caption"
              sx={{ fontWeight: 700, fontSize: '0.7rem' }}
            >
              {trend === "up" && "↑"} {trend === "down" && "↓"} {trendValue}
            </Typography>
          </Box>
        )}
      </Box>

      <Box>
        <Typography 
          variant="h4" 
          sx={{ 
            fontWeight: 700, 
            color: "text.primary",
            mb: 0.5,
            letterSpacing: -0.5
          }}
        >
          {value}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            color: "text.secondary",
            fontSize: '0.875rem',
          }}
        >
          {label}
        </Typography>
      </Box>
    </Card>
  );
}
