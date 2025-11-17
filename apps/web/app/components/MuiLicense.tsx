"use client";

import { LicenseInfo } from "@mui/x-license";

LicenseInfo.setLicenseKey(process.env.NEXT_PUBLIC_MUIX_LICENSE_KEY!);

const MuiXLicense = () => {
  console.log("MUI Key:", process.env.NEXT_PUBLIC_MUIX_LICENSE_KEY?.length);
  return null;
};

export default MuiXLicense;
