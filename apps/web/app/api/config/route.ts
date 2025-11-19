export async function GET() {
  // Use MUIX_LICENSE_KEY (without NEXT_PUBLIC_ prefix) for runtime access
  // Falls back to NEXT_PUBLIC_ version for local dev compatibility
  const muiLicenseKey =
    process.env.MUIX_LICENSE_KEY || process.env.NEXT_PUBLIC_MUIX_LICENSE_KEY;

  console.log("MUI License Key available:", !!muiLicenseKey);

  return Response.json({
    muiLicenseKey,
  });
}
