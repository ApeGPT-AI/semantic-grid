"use client";

import { LicenseInfo } from "@mui/x-license";
import { useEffect } from "react";

const MuiXLicense = () => {
  useEffect(() => {
    // Try to use build-time env var first (for Vercel/build-time injection)
    const buildTimeKey = process.env.NEXT_PUBLIC_MUIX_LICENSE_KEY;

    if (buildTimeKey) {
      LicenseInfo.setLicenseKey(buildTimeKey);
    } else {
      // Fallback to runtime config (for self-hosted/k8s)
      fetch("/api/config")
        .then((res) => res.json())
        .then((config) => {
          if (config.muiLicenseKey) {
            LicenseInfo.setLicenseKey(config.muiLicenseKey);
          } else {
            console.warn("MUI X License key not found in runtime config");
          }
        })
        .catch((err) => {
          console.error("Failed to load runtime config:", err);
        });
    }
  }, []);

  return null;
};

export default MuiXLicense;
